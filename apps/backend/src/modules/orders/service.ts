import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError, type FieldErrors } from "../../utils/api-response.js";
import { jakartaDay } from "../../utils/validation.js";
import type { OrderInput } from "./schema.js";

export const orderInclude = {
  customer: true,
  creator: { select: { id: true, name: true, email: true } },
  items: { include: { product: true }, orderBy: { id: "asc" as const } },
} satisfies Prisma.OrderInclude;

/**
 * Commit an order and its stock changes as one unit, or leave both unchanged.
 * All database work must use `tx`; the global client would bypass these locks.
 */
export async function createOrder(input: OrderInput, userId: bigint, orderDate = new Date()) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          // SHARE prevents a concurrent soft-delete while permitting other orders for this customer.
          const customers = await tx.$queryRaw<{ id: string }[]>`
            SELECT id
            FROM customers
            WHERE id = ${input.customer_id}::uuid AND deleted_at IS NULL
            FOR SHARE
          `;
          if (!customers.length)
            throw AppError.unprocessable("Pelanggan tidak tersedia", {
              customer_id: ["Pilih pelanggan aktif"],
            });

          // Acquire overlapping product locks in the same order to reduce deadlock risk.
          const ids = input.items
            .map((item) => BigInt(item.product_id))
            .sort((a, b) => (a < b ? -1 : 1));
          await tx.$queryRaw`
            SELECT id
            FROM products
            WHERE id IN (${Prisma.join(ids)})
            ORDER BY id
            FOR UPDATE
          `;
          const products = await tx.product.findMany({
            where: { id: { in: ids }, deletedAt: null },
          });
          const byId = new Map(products.map((product) => [String(product.id), product]));
          const errors: FieldErrors = {};
          // Preserve request order so items.N errors still point to the correct UI row.
          const items = input.items.map((item, index) => {
            const product = byId.get(String(item.product_id));
            if (!product) {
              errors[`items.${index}.product_id`] = ["Produk tidak tersedia atau telah dihapus"];
              return null;
            }
            if (product.stock < item.quantity)
              errors[`items.${index}.quantity`] = [
                `Stok ${product.productName} tersisa ${product.stock}, diminta ${item.quantity}`,
              ];
            return {
              productId: product.id,
              quantity: item.quantity,
              unitPrice: product.price,
              subtotal: product.price.mul(item.quantity),
            };
          });
          if (Object.keys(errors).length)
            throw AppError.unprocessable("Stok atau produk tidak tersedia", errors);
          const validItems = items.filter((item) => item !== null);
          // Decimal arithmetic and price snapshots keep monetary history independent of the catalog.
          const totalAmount = validItems.reduce(
            (sum, item) => sum.add(item.subtotal),
            new Prisma.Decimal(0),
          );
          if (totalAmount.greaterThan("999999999999.99"))
            throw AppError.unprocessable("Total melebihi batas transaksi", {
              items: ["Kurangi jumlah item atau quantity"],
            });

          const day = jakartaDay(orderDate).replaceAll("-", "");
          // Daily allocation is serialized across processes, not just this Node instance.
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(812341, ${Number(day)}::integer)::text`;
          const prefix = `INV-${day}-`;
          const last = await tx.order.findFirst({
            where: { orderNumber: { startsWith: prefix } },
            orderBy: { orderNumber: "desc" },
            select: { orderNumber: true },
          });
          const sequence = last ? Number(last.orderNumber.slice(-4)) + 1 : 1;
          if (sequence > 9999) throw AppError.conflict("Batas nomor order harian tercapai");
          const order = await tx.order.create({
            data: {
              orderNumber: `${prefix}${String(sequence).padStart(4, "0")}`,
              customerId: input.customer_id,
              createdBy: userId,
              orderDate,
              totalAmount,
              items: { create: validItems },
            },
          });
          for (const item of validItems) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { decrement: item.quantity } },
            });
          }
          // Read after decrements so the response includes the committed stock state.
          return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude });
        },
        { maxWait: 10000, timeout: 15000 },
      );
    } catch (error) {
      // Retry the entire transaction only for transient database conflicts, never validation errors.
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2034" ||
          (error.code === "P2010" && ["40001", "40P01"].includes(String(error.meta?.code))));
      if (!retryable) throw error;
      if (attempt >= 2) throw AppError.conflict("Transaksi sibuk, silakan coba kembali");
      await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
    }
  }
}
