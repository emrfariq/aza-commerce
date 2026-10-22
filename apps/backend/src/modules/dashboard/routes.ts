import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { ok } from "../../utils/api-response.js";
import { toApi } from "../../utils/serialize.js";
import { dailySales, dailySalesQuery } from "./sales.js";

export const dashboardRouter = Router();
/** Memvalidasi jumlah hari lalu mengirim agregasi penjualan harian dalam format respons API. */
dashboardRouter.get("/daily-sales", async (req, res) => {
  const { days } = dailySalesQuery.parse(req.query);
  return ok(res, toApi(await dailySales(days)));
});
/**
 * Mengambil jumlah transaksi, total penjualan, lima produk terlaris, dan produk aktif dengan
 * stok di bawah lima.
 */
dashboardRouter.get("/summary", async (_req, res) => {
  // RepeatableRead menjaga kartu ringkasan dan peringkat membaca snapshot yang sama saat ada penjualan bersamaan.
  const data = await prisma.$transaction(
    /*
     * Membaca seluruh angka ringkasan dalam snapshot RepeatableRead yang sama agar kartu dan
     * peringkat tetap konsisten saat ada transaksi bersamaan.
     */
    async (tx) => {
      const totals = await tx.order.aggregate({
        _count: { id: true },
        _sum: { totalAmount: true },
      });
      const top = await tx.orderItem.groupBy({
        by: ["productId"],
        _sum: { quantity: true },
        orderBy: [{ _sum: { quantity: "desc" } }, { productId: "asc" }],
        take: 5,
      });
      // Peringkat historis mencakup produk arsip; peringatan stok rendah hanya mencakup produk aktif.
      const products = await tx.product.findMany({
        where: {
          id: {
            in: top.map(
              /*
               * Mengambil ID produk terlaris untuk memuat informasi katalog yang diperlukan.
               */
              (item) => item.productId,
            ),
          },
        },
      });
      const lowStock = await tx.product.findMany({
        where: { deletedAt: null, stock: { lt: 5 } },
        orderBy: [{ stock: "asc" }, { id: "asc" }],
      });
      return {
        totalTransactions: totals._count.id,
        totalSales: totals._sum.totalAmount ?? new Prisma.Decimal(0),
        topProducts: top.map(
          /*
           * Menggabungkan informasi produk dengan total kuantitas terjual untuk setiap
           * posisi peringkat.
           */
          (item) => ({
            product: products.find(
              /*
               * Mencocokkan produk katalog dengan ID produk hasil agregasi penjualan.
               */
              (product) => product.id === item.productId,
            ),
            quantitySold: item._sum.quantity ?? 0,
          }),
        ),
        lowStockProducts: lowStock,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
  return ok(res, toApi(data));
});
