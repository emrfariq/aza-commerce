import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { AppError, buildMeta, created, noContent, ok } from "../../utils/api-response.js";
import { pagination, uuid } from "../../utils/validation.js";
import { toApi } from "../../utils/serialize.js";
import { customerInput } from "./schema.js";

export const customersRouter = Router();
customersRouter.get("/", async (req, res) => {
  const q = pagination.parse(req.query);
  const where = {
    deletedAt: null,
    customerName: { contains: q.search, mode: "insensitive" as const },
  };
  const [total, rows] = await prisma.$transaction([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      skip: (q.page - 1) * q.per_page,
      take: q.per_page,
      orderBy: [{ customerName: "asc" }, { id: "asc" }],
    }),
  ]);
  return ok(res, toApi(rows), "OK", buildMeta(q.page, q.per_page, total));
});
customersRouter.get("/:id", async (req, res) => {
  const row = await prisma.customer.findFirst({
    where: { id: uuid.parse(req.params.id), deletedAt: null },
  });
  if (!row) throw AppError.notFound("Pelanggan tidak ditemukan");
  return ok(res, toApi(row));
});
customersRouter.post("/", async (req, res) => {
  const input = customerInput.parse(req.body);
  const row = await prisma.customer.create({
    data: {
      customerName: input.customer_name,
      customerAddress: input.customer_address,
      gender: input.gender,
      birthDate: new Date(`${input.birth_date}T00:00:00Z`),
      phone: input.phone || null,
    },
  });
  return created(res, toApi(row), "Pelanggan ditambahkan");
});
customersRouter.put("/:id", async (req, res) => {
  const input = customerInput.parse(req.body);
  const row = await prisma.customer.update({
    where: { id: uuid.parse(req.params.id), deletedAt: null },
    data: {
      customerName: input.customer_name,
      customerAddress: input.customer_address,
      gender: input.gender,
      birthDate: new Date(`${input.birth_date}T00:00:00Z`),
      phone: input.phone || null,
    },
  });
  return ok(res, toApi(row), "Pelanggan diperbarui");
});
customersRouter.delete("/:id", async (req, res) => {
  await prisma.customer.update({
    where: { id: uuid.parse(req.params.id), deletedAt: null },
    data: { deletedAt: new Date() },
  });
  return noContent(res);
});
