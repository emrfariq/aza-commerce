import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { ok } from "../../utils/api-response.js";
import { toApi } from "../../utils/serialize.js";
import { dailySales, dailySalesQuery } from "./sales.js";

export const dashboardRouter = Router();
dashboardRouter.get("/daily-sales", async (req, res) => {
  const { days } = dailySalesQuery.parse(req.query);
  return ok(res, toApi(await dailySales(days)));
});
dashboardRouter.get("/summary", async (_req, res) => {
  // RepeatableRead keeps cards and rankings on the same snapshot during concurrent sales.
  const data = await prisma.$transaction(
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
      // Historical rankings include archived products; low-stock warnings include active ones only.
      const products = await tx.product.findMany({
        where: { id: { in: top.map((item) => item.productId) } },
      });
      const lowStock = await tx.product.findMany({
        where: { deletedAt: null, stock: { lt: 5 } },
        orderBy: [{ stock: "asc" }, { id: "asc" }],
      });
      return {
        totalTransactions: totals._count.id,
        totalSales: totals._sum.totalAmount ?? new Prisma.Decimal(0),
        topProducts: top.map((item) => ({
          product: products.find((product) => product.id === item.productId),
          quantitySold: item._sum.quantity ?? 0,
        })),
        lowStockProducts: lowStock,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
  return ok(res, toApi(data));
});
