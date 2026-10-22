import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { authSession } from "../../middlewares/auth.js";
import { AppError, buildMeta, created, ok } from "../../utils/api-response.js";
import { numericId } from "../../utils/validation.js";
import { toApi } from "../../utils/serialize.js";
import { orderExport, orderInput, orderList } from "./schema.js";
import { createOrder, orderInclude } from "./service.js";
import { buildOrderWhere } from "./filters.js";
import { exportOrders } from "./export.js";

export const ordersRouter = Router();
/**
 * Memvalidasi filter pelanggan dan tanggal lalu mengambil riwayat order per halaman beserta
 * total data.
 */
ordersRouter.get("/", async (req, res) => {
  const q = orderList.parse(req.query);
  const where = buildOrderWhere(q);
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
// Daftarkan sebelum /:id agar kata export tidak dianggap sebagai ID order.
/**
 * Memvalidasi format dan filter ekspor lalu mengirim berkas dengan header unduhan. Rute ini
 * dipasang sebelum /:id agar kata export tidak dianggap ID.
 */
ordersRouter.get("/export", async (req, res) => {
  const q = orderExport.parse(req.query);
  const file = await exportOrders(q, q.format);
  res.set({
    "Content-Type": file.contentType,
    "Content-Disposition": `attachment; filename="${file.filename}"`,
    "Cache-Control": "no-store",
  });
  return res.status(200).send(file.body);
});
/**
 * Mengambil detail order beserta pelanggan, pembuat, dan item; menghasilkan 404 jika ID tidak
 * ditemukan.
 */
ordersRouter.get("/:id", async (req, res) => {
  const row = await prisma.order.findUnique({
    where: { id: numericId.parse(req.params.id) },
    include: orderInclude,
  });
  if (!row) throw AppError.notFound("Order tidak ditemukan");
  return ok(res, toApi(row));
});
/**
 * Memvalidasi isi order lalu menyerahkan perhitungan harga, pemeriksaan stok, dan penyimpanan
 * transaksi ke createOrder dengan ID pengguna aktif.
 */
ordersRouter.post("/", async (req, res) => {
  const row = await createOrder(orderInput.parse(req.body), authSession(res).userId);
  return created(res, toApi(row), "Order berhasil dibuat");
});
