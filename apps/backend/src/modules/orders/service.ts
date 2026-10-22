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
 * Membuat order, menyimpan harga saat transaksi, dan mengurangi stok dalam satu transaksi
 * database: seluruh perubahan berhasil bersama atau dibatalkan. Mengunci pelanggan, produk, dan
 * alokasi nomor invoice untuk menangani request bersamaan, serta mencoba ulang konflik database
 * sementara maksimal tiga kali.
 */
export async function createOrder(input: OrderInput, userId: bigint, orderDate = new Date()) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(
        /*
         * Menjalankan seluruh operasi order melalui tx agar validasi, lock, pembuatan
         * invoice, dan pengurangan stok berada dalam transaksi yang sama.
         */
        async (tx) => {
          // Lock SHARE mencegah soft delete pelanggan selama transaksi sambil mengizinkan order lain untuk pelanggan yang sama.
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

          // Ambil lock produk dalam urutan yang sama antartransaksi untuk mengurangi risiko deadlock.
          const ids = input.items
            .map(
              /*
               * Mengubah ID produk dari input menjadi BigInt sesuai tipe ID di database.
               */
              (item) => BigInt(item.product_id),
            )
            .sort(
              /*
               * Mengurutkan ID agar semua transaksi mengambil lock produk dalam urutan yang
               * sama dan mengurangi risiko deadlock.
               */
              (a, b) => (a < b ? -1 : 1),
            );
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
          const byId = new Map(
            products.map(
              /*
               * Memasangkan ID berbentuk string dengan data produk agar pencarian tiap item
               * tidak perlu mengulang seluruh daftar.
               */
              (product) => [String(product.id), product],
            ),
          );
          const errors: FieldErrors = {};
          // Pertahankan urutan input agar error items.N tetap menunjuk baris form yang benar.
          const items = input.items.map(
            /*
             * Memeriksa produk aktif dan kecukupan stok per baris, lalu menyimpan harga
             * satuan dan subtotal dari database sebagai snapshot transaksi.
             */
            (item, index) => {
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
            },
          );
          if (Object.keys(errors).length)
            throw AppError.unprocessable("Stok atau produk tidak tersedia", errors);
          const validItems = items.filter(
            /*
             * Menyaring hasil kosong sehingga daftar yang disimpan hanya berisi item produk
             * yang ditemukan.
             */
            (item) => item !== null,
          );
          // Operasi Decimal dan snapshot harga menjaga presisi nominal serta riwayat harga meskipun katalog berubah.
          const totalAmount = validItems.reduce(
            /*
             * Menjumlahkan subtotal dengan Decimal agar total harga tidak terkena galat
             * floating-point.
             */
            (sum, item) => sum.add(item.subtotal),
            new Prisma.Decimal(0),
          );
          if (totalAmount.greaterThan("999999999999.99"))
            throw AppError.unprocessable("Total melebihi batas transaksi", {
              items: ["Kurangi jumlah item atau quantity"],
            });

          const day = jakartaDay(orderDate).replaceAll("-", "");
          // Advisory lock database mengurutkan alokasi nomor harian di seluruh proses aplikasi.
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
          // Baca ulang setelah pengurangan agar respons memuat stok hasil transaksi; commit dilakukan setelah callback selesai.
          return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude });
        },
        { maxWait: 10000, timeout: 15000 },
      );
    } catch (error) {
      // Ulangi seluruh transaksi hanya untuk konflik database sementara; error validasi langsung diteruskan.
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2034" ||
          (error.code === "P2010" && ["40001", "40P01"].includes(String(error.meta?.code))));
      if (!retryable) throw error;
      if (attempt >= 2) throw AppError.conflict("Transaksi sibuk, silakan coba kembali");
      await new Promise(
        /*
         * Memberi jeda yang bertambah sebelum mengulang transaksi yang mengalami konflik
         * sementara.
         */
        (resolve) => setTimeout(resolve, 25 * (attempt + 1)),
      );
    }
  }
}
