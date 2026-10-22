import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError, buildMeta, created, noContent, ok } from "../../utils/api-response.js";
import { numericId } from "../../utils/validation.js";
import { toApi } from "../../utils/serialize.js";
import { productInput, productList } from "./schema.js";

export const productsRouter = Router();
/**
 * Mengambil produk aktif dengan pencarian nama atau kode, pagination, dan pengurutan yang sudah
 * divalidasi; ID menjadi pengurut tambahan agar urutan stabil.
 */
productsRouter.get("/", async (req, res) => {
  const q = productList.parse(req.query);
  const where: Prisma.ProductWhereInput = {
    deletedAt: null,
    OR: [
      { productName: { contains: q.search, mode: "insensitive" } },
      { productCode: { contains: q.search, mode: "insensitive" } },
    ],
  };
  const field = q.sort.replace(/^-/, "");
  const column = field === "product_name" ? "productName" : field;
  const [total, rows] = await prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      skip: (q.page - 1) * q.per_page,
      take: q.per_page,
      orderBy: [{ [column]: q.sort.startsWith("-") ? "desc" : "asc" }, { id: "asc" }],
    }),
  ]);
  return ok(res, toApi(rows), "OK", buildMeta(q.page, q.per_page, total));
});
/** Memvalidasi ID numerik dan mengambil satu produk aktif; menghasilkan 404 jika tidak ditemukan. */
productsRouter.get("/:id", async (req, res) => {
  const row = await prisma.product.findFirst({
    where: { id: numericId.parse(req.params.id), deletedAt: null },
  });
  if (!row) throw AppError.notFound("Produk tidak ditemukan");
  return ok(res, toApi(row));
});
/** Memvalidasi kode, nama, stok, dan harga lalu membuat produk dengan respons HTTP 201. */
productsRouter.post("/", async (req, res) => {
  const input = productInput.parse(req.body);
  const row = await prisma.product.create({
    data: {
      productCode: input.product_code,
      productName: input.product_name,
      stock: input.stock,
      price: input.price,
    },
  });
  return created(res, toApi(row), "Produk ditambahkan");
});
/**
 * Memperbarui produk aktif; nilai stock merupakan stok akhir yang dimasukkan admin, bukan jumlah
 * penambahan stok.
 */
productsRouter.put("/:id", async (req, res) => {
  const id = numericId.parse(req.params.id);
  const input = productInput.parse(req.body);
  const row = await prisma.product.update({
    where: { id, deletedAt: null },
    data: {
      productCode: input.product_code,
      productName: input.product_name,
      stock: input.stock,
      price: input.price,
    },
  });
  return ok(res, toApi(row), "Produk diperbarui");
});
/**
 * Menandai produk sebagai terhapus dengan deletedAt tanpa menghapus catatan yang masih digunakan
 * riwayat order.
 */
productsRouter.delete("/:id", async (req, res) => {
  await prisma.product.update({
    where: { id: numericId.parse(req.params.id), deletedAt: null },
    data: { deletedAt: new Date() },
  });
  return noContent(res);
});
