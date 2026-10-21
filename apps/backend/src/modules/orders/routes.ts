import { Router } from "express";
import { type Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { authSession } from "../../middlewares/auth.js";
import { AppError, buildMeta, created, ok } from "../../utils/api-response.js";
import { dayStart, numericId } from "../../utils/validation.js";
import { toApi } from "../../utils/serialize.js";
import { orderInput, orderList } from "./schema.js";
import { createOrder, orderInclude } from "./service.js";

export const ordersRouter = Router();
ordersRouter.get("/", async (req, res) => {
  const q = orderList.parse(req.query);
  // Inclusive calendar dates become [start, next-day start) in the business timezone.
  const end = q.to ? new Date(dayStart(q.to).getTime() + 86400000) : undefined;
  const where: Prisma.OrderWhereInput = {
    customerId: q.customer_id,
    orderDate: { ...(q.from ? { gte: dayStart(q.from) } : {}), ...(end ? { lt: end } : {}) },
  };
  const [total, rows] = await prisma.$transaction([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      skip: (q.page - 1) * q.per_page,
      take: q.per_page,
      include: { customer: true, _count: { select: { items: true } } },
      orderBy: [{ orderDate: "desc" }, { id: "desc" }],
    }),
  ]);
  return ok(res, toApi(rows), "OK", buildMeta(q.page, q.per_page, total));
});
ordersRouter.get("/:id", async (req, res) => {
  const row = await prisma.order.findUnique({
    where: { id: numericId.parse(req.params.id) },
    include: orderInclude,
  });
  if (!row) throw AppError.notFound("Order tidak ditemukan");
  return ok(res, toApi(row));
});
ordersRouter.post("/", async (req, res) => {
  const row = await createOrder(orderInput.parse(req.body), authSession(res).userId);
  return created(res, toApi(row), "Order berhasil dibuat");
});
