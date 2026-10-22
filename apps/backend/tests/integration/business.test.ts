import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import ExcelJS from "exceljs";
import { parse } from "csv-parse/sync";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { dayStart, jakartaDay } from "../../src/utils/validation.js";

if (!new URL(process.env.DATABASE_URL!).pathname.endsWith("_test"))
  throw new Error("Integration tests require a _test database");
const app = createApp();
let passwordHash: string;
let token: string;
let customerId: string;
let firstId: number;
let secondId: number;
/** Membentuk header Bearer dari access token pengguna pengujian. */
const auth = () => ({ Authorization: `Bearer ${token}` });
/** Membentuk payload order dasar dengan kuantitas yang dapat disesuaikan tiap skenario. */
const order = (quantity = 2) => ({
  customer_id: customerId,
  items: [{ product_id: firstId, quantity }],
});

/** Menghasilkan hash password sekali sebelum seluruh pengujian agar setup berikutnya lebih cepat. */
beforeAll(async () => {
  passwordHash = await bcrypt.hash("Test123!", 10);
});
/**
 * Mengosongkan tabel pada database uji lalu membuat ulang pengguna, sesi login, produk, dan
 * pelanggan agar tiap kasus terisolasi.
 */
beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    "TRUNCATE TABLE order_items, orders, refresh_tokens, customers, products, users RESTART IDENTITY CASCADE",
  );
  await prisma.user.create({
    data: { email: "admin@test.id", name: "Admin Test", password: passwordHash },
  });
  const customer = await prisma.customer.create({
    data: {
      customerName: "Budi",
      customerAddress: "Jakarta",
      gender: "Pria",
      birthDate: new Date("1995-02-10"),
    },
  });
  customerId = customer.id;
  const first = await prisma.product.create({
    data: { productCode: "P0001", productName: "Hydrococo", stock: 10, price: "12000.50" },
  });
  const second = await prisma.product.create({
    data: { productCode: "P0002", productName: "Kopi", stock: 3, price: "15000.25" },
  });
  firstId = Number(first.id);
  secondId = Number(second.id);
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: "admin@test.id", password: "Test123!" });
  expect(login.status).toBe(200);
  token = login.body.data.access_token as string;
});
/** Melepas koneksi Prisma setelah seluruh pengujian integrasi selesai. */
afterAll(() => prisma.$disconnect());

let reportSequence = 100;
/**
 * Membuat fixture order dengan tanggal, nominal, dan pelanggan tertentu untuk menguji laporan
 * dan filter.
 */
async function reportOrder(date: Date, amount: string, targetCustomer = customerId) {
  return prisma.order.create({
    data: {
      orderNumber: `INV-${jakartaDay(date).replaceAll("-", "")}-${String(++reportSequence).padStart(4, "0")}`,
      customerId: targetCustomer,
      createdBy: 1n,
      orderDate: date,
      totalAmount: amount,
      items: {
        create: { productId: BigInt(firstId), quantity: 1, unitPrice: amount, subtotal: amount },
      },
    },
  });
}

/** Mengelompokkan pengujian order menggunakan transaksi PostgreSQL asli. */
describe("orders: real PostgreSQL transactions", () => {
  /** Memastikan order multi-item menyimpan snapshot harga dan menghitung total presisi di server. */
  it("creates a multi-item order, snapshots prices and calculates exact totals on the server", async () => {
    const result = await request(app)
      .post("/api/orders")
      .set(auth())
      .send({
        customer_id: customerId,
        items: [
          { product_id: firstId, quantity: 2 },
          { product_id: secondId, quantity: 1 },
        ],
      });
    expect(result.status).toBe(201);
    expect(result.body.data.total_amount).toBe("39001.25");
    expect(result.body.data.items[0].unit_price).toBe("12000.50");
    expect(result.body.data.items[0].product.stock).toBe(8);
    expect(result.body.data.order_number).toMatch(/^INV-\d{8}-0001$/);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: BigInt(firstId) } })).stock).toBe(
      8,
    );
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: BigInt(secondId) } })).stock,
    ).toBe(2);
    expect(await prisma.orderItem.count()).toBe(2);
  });

  /** Memastikan kekurangan stok pada item kedua membatalkan seluruh order beserta perubahan stok. */
  it("rolls back the entire order when its second item has insufficient stock", async () => {
    const result = await request(app)
      .post("/api/orders")
      .set(auth())
      .send({
        customer_id: customerId,
        items: [
          { product_id: firstId, quantity: 2 },
          { product_id: secondId, quantity: 5 },
        ],
      });
    expect(result.status).toBe(422);
    expect(result.body.errors["items.1.quantity"][0]).toContain("tersisa 3");
    expect(await prisma.order.count()).toBe(0);
    expect(await prisma.orderItem.count()).toBe(0);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: BigInt(firstId) } })).stock).toBe(
      10,
    );
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: BigInt(secondId) } })).stock,
    ).toBe(3);
  });

  /**
   * Memastikan kuantitas tidak valid, produk ganda, keranjang kosong, dan harga kiriman klien
   * ditolak.
   */
  it("rejects invalid quantities, duplicate items, an empty cart and client-supplied prices", async () => {
    for (const body of [
      order(0),
      { ...order(), price: 1 },
      { ...order(), items: [] },
      { ...order(), items: [{ product_id: firstId, quantity: 1, price: 1 }] },
      {
        ...order(),
        items: [
          { product_id: firstId, quantity: 1 },
          { product_id: firstId, quantity: 1 },
        ],
      },
    ]) {
      const result = await request(app).post("/api/orders").set(auth()).send(body);
      expect(result.status).toBe(422);
      expect(result.body.success).toBe(false);
    }
    expect(await prisma.order.count()).toBe(0);
  });

  /** Memastikan dua request bersamaan tidak bisa menjual melebihi satu stok terakhir. */
  it("prevents overselling when simultaneous requests compete for the last stock", async () => {
    await prisma.product.update({ where: { id: BigInt(firstId) }, data: { stock: 1 } });
    const results = await Promise.all(
      [1, 2].map(
        /*
         * Mengirim request order bersamaan yang sama-sama meminta satu unit produk terakhir.
         */
        () => request(app).post("/api/orders").set(auth()).send(order(1)),
      ),
    );
    expect(
      results
        .map(
          /*
           * Mengambil status tiap request untuk memastikan satu berhasil dan satu ditolak.
           */
          (result) => result.status,
        )
        .sort(),
    ).toEqual([201, 422]);
    expect(await prisma.order.count()).toBe(1);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: BigInt(firstId) } })).stock).toBe(
      0,
    );
  });

  /** Memastikan order bersamaan pada produk berbeda memperoleh nomor invoice berurutan yang unik. */
  it("allocates distinct sequential numbers for concurrent orders on different products", async () => {
    const results = await Promise.all(
      [firstId, secondId].map(
        /*
         * Membuat request order untuk masing-masing produk agar alokasi nomor diuji secara
         * bersamaan.
         */
        (id) =>
          request(app)
            .post("/api/orders")
            .set(auth())
            .send({ customer_id: customerId, items: [{ product_id: id, quantity: 1 }] }),
      ),
    );
    expect(
      results.map(
        /*
         * Mengambil status respons guna memastikan kedua order berhasil dibuat.
         */
        (result) => result.status,
      ),
    ).toEqual([201, 201]);
    expect(
      new Set(
        results.map(
          /*
           * Mengambil nomor invoice dari tiap respons untuk memeriksa keunikannya.
           */
          (result) => result.body.data.order_number,
        ),
      ).size,
    ).toBe(2);
  });

  /**
   * Memastikan harga transaksi dan riwayat order tetap tersedia setelah data master diubah atau
   * dihapus secara soft delete.
   */
  it("preserves snapshot prices and history after product/customer changes and soft deletion", async () => {
    const result = await request(app).post("/api/orders").set(auth()).send(order());
    const id = result.body.data.id as number;
    await prisma.product.update({ where: { id: BigInt(firstId) }, data: { price: "99000.00" } });
    expect((await request(app).delete(`/api/products/${firstId}`).set(auth())).status).toBe(204);
    expect((await request(app).delete(`/api/customers/${customerId}`).set(auth())).status).toBe(
      204,
    );
    const detail = await request(app).get(`/api/orders/${id}`).set(auth());
    expect(detail.status).toBe(200);
    expect(detail.body.data.total_amount).toBe("24001.00");
    expect(detail.body.data.items[0].unit_price).toBe("12000.50");
    expect(detail.body.data.items[0].product.product_name).toBe("Hydrococo");
    expect(detail.body.data.customer.customer_name).toBe("Budi");
    expect((await request(app).post("/api/orders").set(auth()).send(order())).status).toBe(422);
    expect((await request(app).get(`/api/products/${firstId}`).set(auth())).status).toBe(404);
  });
});

/** Mengelompokkan pengujian autentikasi serta batas validasi input. */
describe("authentication and input boundaries", () => {
  /**
   * Memastikan endpoint terlindungi menolak request tanpa token, token tidak valid, dan token
   * kedaluwarsa.
   */
  it("rejects requests without a token, invalid tokens and expired tokens", async () => {
    for (const path of [
      "/api/products",
      "/api/customers",
      "/api/orders",
      "/api/dashboard/summary",
      "/api/auth/me",
      "/api/health",
    ]) {
      expect((await request(app).get(path)).status).toBe(401);
    }
    const expired = jwt.sign(
      { sub: "1", sid: "1", kind: "access" },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: -1, issuer: "azatech-order-api", audience: "azatech-admin" },
    );
    for (const value of ["bad-token", expired])
      expect(
        (await request(app).get("/api/products").set("Authorization", `Bearer ${value}`)).status,
      ).toBe(401);
  });

  /**
   * Memastikan refresh token dirotasi dan logout membatalkan akses maupun refresh dari sesi yang
   * sama.
   */
  it("rotates refresh tokens and revokes both refresh and access credentials on logout", async () => {
    const agent = request.agent(app);
    const login = await agent
      .post("/api/auth/login")
      .send({ email: "admin@test.id", password: "Test123!" });
    const oldCookie = (login.headers["set-cookie"] as unknown as string[])[0]!.split(";")[0]!;
    const refreshed = await agent.post("/api/auth/refresh");
    expect(refreshed.status).toBe(200);
    expect((await request(app).post("/api/auth/refresh").set("Cookie", oldCookie)).status).toBe(
      401,
    );
    const access = refreshed.body.data.access_token as string;
    expect(
      (await agent.post("/api/auth/logout").set("Authorization", `Bearer ${access}`)).status,
    ).toBe(200);
    expect(
      (await request(app).get("/api/auth/me").set("Authorization", `Bearer ${access}`)).status,
    ).toBe(401);
    expect((await agent.post("/api/auth/refresh")).status).toBe(401);
  });

  /**
   * Memastikan Swagger dari origin API dapat login dan refresh, sementara origin browser yang
   * tidak dikonfigurasi ditolak.
   */
  it("permits same-origin Swagger login/refresh and rejects unconfigured browser origins", async () => {
    const agent = request.agent(app);
    const swaggerOrigin = new URL(process.env.API_PUBLIC_URL ?? "http://localhost:4000/api").origin;
    const login = await agent
      .post("/api/auth/login")
      .set("Origin", swaggerOrigin)
      .send({ email: "admin@test.id", password: "Test123!" });
    expect(login.status).toBe(200);
    expect(login.headers["access-control-allow-origin"]).toBe(swaggerOrigin);
    expect((await agent.post("/api/auth/refresh").set("Origin", swaggerOrigin)).status).toBe(200);
    const forbidden = await request(app)
      .post("/api/auth/login")
      .set("Origin", "https://untrusted.example")
      .send({ email: "admin@test.id", password: "Test123!" });
    expect(forbidden.status).toBe(403);
    expect(forbidden.headers["access-control-allow-origin"]).toBeUndefined();
  });

  /**
   * Memastikan login gagal, tanggal tidak valid, JSON rusak, dan resource tidak ditemukan
   * menghasilkan error yang konsisten.
   */
  it("returns consistent errors for invalid login, dates, malformed JSON and unknown resources", async () => {
    expect(
      (
        await request(app)
          .post("/api/auth/login")
          .send({ email: "admin@test.id", password: "wrong" })
      ).status,
    ).toBe(401);
    expect((await request(app).get("/api/orders?from=2026-02-30").set(auth())).status).toBe(422);
    expect(
      (await request(app).get("/api/orders?from=2026-03-01&to=2026-02-01").set(auth())).status,
    ).toBe(422);
    expect((await request(app).get("/api/orders/99999").set(auth())).status).toBe(404);
    expect((await request(app).get("/api/products/9007199254740992").set(auth())).status).toBe(422);
    const malformed = await request(app)
      .post("/api/products")
      .set(auth())
      .set("Content-Type", "application/json")
      .send("{broken");
    expect(malformed.status).toBe(400);
    expect(malformed.body.success).toBe(false);
  });
});

/** Mengelompokkan pengujian agregasi harian dan ekspor riwayat order. */
describe("daily sales and history exports", () => {
  /**
   * Memastikan agregasi mengikuti hari kalender Jakarta, mengisi hari kosong, dan memperlakukan
   * batas periode dengan tepat.
   */
  it("groups by Jakarta calendar day, fills gaps, and excludes range boundaries correctly", async () => {
    const today = jakartaDay(new Date());
    const todayStart = dayStart(today);
    const firstDay = new Date(todayStart.getTime() - 3 * 86400000);
    await reportOrder(firstDay, "100.10");
    await reportOrder(new Date(todayStart.getTime() - 1), "200.20");
    await reportOrder(new Date(todayStart.getTime() + 1), "300.30");
    await reportOrder(new Date(firstDay.getTime() - 1), "900.90");
    await reportOrder(new Date(todayStart.getTime() + 86400000), "800.80");
    const result = await request(app).get("/api/dashboard/daily-sales?days=4").set(auth());
    expect(result.status).toBe(200);
    expect(result.body.data.from).toBe(jakartaDay(firstDay));
    expect(result.body.data.to).toBe(today);
    expect(result.body.data.total_transactions).toBe(3);
    expect(result.body.data.total_sales).toBe("600.60");
    expect(
      result.body.data.series.map(
        /*
         * Mengambil nominal tiap hari untuk membandingkan hasil seri dengan nilai yang
         * diharapkan.
         */
        (day: { total_sales: string }) => day.total_sales,
      ),
    ).toEqual(["100.10", "0.00", "200.20", "300.30"]);
    expect(result.body.data.series[1].total_transactions).toBe(0);
  });

  /** Memastikan periode tanpa penjualan tetap menghasilkan seri harian lengkap dengan nilai nol. */
  it("returns zero-valued daily series for an empty reporting period", async () => {
    const result = await request(app).get("/api/dashboard/daily-sales?days=7").set(auth());
    expect(result.status).toBe(200);
    expect(result.body.data.series).toHaveLength(7);
    expect(result.body.data.total_sales).toBe("0.00");
    expect(result.body.data.total_transactions).toBe(0);
    expect(
      result.body.data.series.every(
        /*
         * Memeriksa bahwa nominal setiap hari pada periode kosong bernilai 0.00.
         */
        (day: { total_sales: string }) => day.total_sales === "0.00",
      ),
    ).toBe(true);
  });

  /**
   * Memastikan CSV dapat diparsing, memiliki satu baris per order, mempertahankan nominal, dan
   * melindungi teks dari formula spreadsheet.
   */
  it("exports RFC-compatible CSV with one row per order, exact totals and formula-safe text", async () => {
    await prisma.customer.update({
      where: { id: customerId },
      data: {
        customerName: "=SUM(1,2)",
        customerAddress: 'Jl. "Mawar", Jakarta\nLantai 2',
        phone: "+628123456",
      },
    });
    const created = await request(app)
      .post("/api/orders")
      .set(auth())
      .send({
        customer_id: customerId,
        items: [
          { product_id: firstId, quantity: 2 },
          { product_id: secondId, quantity: 1 },
        ],
      });
    expect(created.status).toBe(201);
    const result = await request(app)
      .get("/api/orders/export?format=csv")
      .set(auth())
      .set("Origin", process.env.FRONTEND_URL ?? "http://localhost:3200");
    expect(result.status).toBe(200);
    expect(result.headers["content-type"]).toContain("text/csv");
    expect(result.headers["content-disposition"]).toMatch(
      /attachment; filename="riwayat-order-\d{8}\.csv"/,
    );
    expect(result.headers["access-control-expose-headers"]).toContain("Content-Disposition");
    expect(result.headers["cache-control"]).toBe("no-store");
    expect(result.text.startsWith("\uFEFF")).toBe(true);
    const rows = parse(result.text, { bom: true, columns: true }) as Record<string, string>[];
    expect(rows).toHaveLength(1);
    expect(rows[0]?.["Pelanggan"]).toBe("'=SUM(1,2)");
    expect(rows[0]?.["Alamat"]).toBe('Jl. "Mawar", Jakarta\nLantai 2');
    expect(rows[0]?.["Telepon"]).toBe("'+628123456");
    expect(rows[0]?.["Jumlah Produk"]).toBe("2");
    expect(rows[0]?.["Total Quantity"]).toBe("3");
    expect(rows[0]?.["Total Penjualan"]).toBe("39001.25");
  });

  /**
   * Memastikan ekspor memuat seluruh hasil lintas halaman dengan filter pelanggan dan tanggal
   * inklusif yang sama seperti riwayat.
   */
  it("exports every matching page with the same customer and inclusive-date filters as history", async () => {
    for (let index = 0; index < 20; index++)
      await reportOrder(new Date("2026-10-21T12:00:00+07:00"), "100.10");
    await reportOrder(new Date("2026-10-21T23:59:59+07:00"), "200.20");
    await reportOrder(new Date("2026-10-22T00:00:00+07:00"), "300.30");
    const other = await prisma.customer.create({
      data: {
        customerName: "Pelanggan Lain",
        customerAddress: "Bandung",
        gender: "Wanita",
        birthDate: new Date("1995-02-10"),
      },
    });
    await reportOrder(new Date("2026-10-21T12:00:00+07:00"), "400.40", other.id);
    const filter = `from=2026-10-21&to=2026-10-21&customer_id=${customerId}&per_page=1`;
    const list = await request(app).get(`/api/orders?${filter}`).set(auth());
    expect(list.body.meta.total).toBe(21);
    expect(list.body.data).toHaveLength(1);
    const result = await request(app).get(`/api/orders/export?format=csv&${filter}`).set(auth());
    const rows = parse(result.text, { bom: true, columns: true }) as Record<string, string>[];
    expect(rows).toHaveLength(21);
    expect(rows[0]?.["Tanggal Order (WIB)"]).toBe("2026-10-21 23:59:59");
    expect(
      rows.every(
        /*
         * Memeriksa bahwa setiap baris ekspor berasal dari pelanggan yang difilter.
         */
        (row) => row.Pelanggan === "Budi",
      ),
    ).toBe(true);
  });

  /**
   * Memastikan berkas XLSX asli memiliki dua sheet, harga snapshot, serta data master yang sudah
   * diarsipkan.
   */
  it("exports a real XLSX workbook with two sheets, snapshot prices and archived master data", async () => {
    await prisma.customer.update({
      where: { id: customerId },
      data: { customerName: "=SUM(1,2)", phone: "081234567890" },
    });
    expect((await request(app).post("/api/orders").set(auth()).send(order())).status).toBe(201);
    await prisma.product.update({
      where: { id: BigInt(firstId) },
      data: { price: "99000.00", deletedAt: new Date() },
    });
    await prisma.customer.update({ where: { id: customerId }, data: { deletedAt: new Date() } });
    const result = await request(app)
      .get(`/api/orders/export?format=xlsx&customer_id=${customerId}`)
      .set(auth())
      .buffer(true)
      .parse(
        /*
         * Mengumpulkan respons biner Supertest menjadi Buffer agar workbook XLSX bisa dibaca
         * kembali.
         */
        (response, done) => {
          const chunks: Buffer[] = [];
          /** Menyimpan potongan data biner yang diterima dari stream respons. */
          response.on("data", (chunk: Buffer) => chunks.push(chunk));
          /**
           * Menggabungkan semua potongan data saat stream selesai lalu meneruskannya ke pembaca
           * workbook.
           */
          response.on("end", () => done(null, Buffer.concat(chunks)));
        },
      );
    expect(result.status).toBe(200);
    expect(result.headers["content-type"]).toContain(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(result.body);
    expect(
      workbook.worksheets.map(
        /*
         * Mengambil nama worksheet untuk memeriksa struktur workbook hasil ekspor.
         */
        (sheet) => sheet.name,
      ),
    ).toEqual(["Ringkasan Order", "Detail Item"]);
    const summary = workbook.getWorksheet("Ringkasan Order")!;
    const details = workbook.getWorksheet("Detail Item")!;
    expect(summary.rowCount).toBe(2);
    expect(summary.getCell("C2").value).toBe("=SUM(1,2)");
    expect(summary.getCell("C2").type).toBe(ExcelJS.ValueType.String);
    expect(summary.getCell("D2").value).toBe("081234567890");
    expect(summary.getCell("H2").value).toBe(24001);
    expect(details.getCell("G2").value).toBe(12000.5);
    expect(details.getCell("H2").value).toBe(24001);
    expect(await prisma.order.count()).toBe(1);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: BigInt(firstId) } })).stock).toBe(
      8,
    );
  });

  /**
   * Memastikan filter tanpa hasil tetap menghasilkan CSV dan XLSX valid yang hanya berisi
   * header.
   */
  it("produces valid header-only CSV and Excel downloads for an empty filter result", async () => {
    const csv = await request(app).get("/api/orders/export?format=csv&to=2000-01-01").set(auth());
    expect(csv.status).toBe(200);
    expect(parse(csv.text, { bom: true, columns: true })).toEqual([]);
    const xlsx = await request(app)
      .get("/api/orders/export?format=xlsx&to=2000-01-01")
      .set(auth())
      .buffer(true)
      .parse(
        /*
         * Membaca respons workbook kosong sebagai Buffer tanpa mencoba menguraikannya
         * menjadi JSON.
         */
        (response, done) => {
          const chunks: Buffer[] = [];
          /** Mengumpulkan potongan biner workbook kosong dari stream respons. */
          response.on("data", (chunk: Buffer) => chunks.push(chunk));
          /**
           * Menggabungkan potongan biner setelah stream berakhir agar workbook kosong dapat
           * diperiksa.
           */
          response.on("end", () => done(null, Buffer.concat(chunks)));
        },
      );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(xlsx.body);
    expect(
      workbook.worksheets.map(
        /*
         * Mengambil jumlah baris tiap sheet untuk memastikan hanya baris header yang
         * tersisa.
         */
        (sheet) => sheet.rowCount,
      ),
    ).toEqual([1, 1]);
  });

  /**
   * Memastikan laporan dan ekspor memerlukan autentikasi serta menolak parameter yang tidak
   * valid.
   */
  it("requires authentication and validates reporting/export parameters", async () => {
    expect((await request(app).get("/api/orders/export?format=csv")).status).toBe(401);
    expect((await request(app).get("/api/dashboard/daily-sales")).status).toBe(401);
    for (const query of ["days=0", "days=367", "days=2.5", "days=invalid"]) {
      expect(
        (await request(app).get(`/api/dashboard/daily-sales?${query}`).set(auth())).status,
      ).toBe(422);
    }
    for (const query of [
      "format=pdf",
      "from=2026-10-22&to=2026-10-21",
      "from=2026-02-30",
      "customer_id=invalid",
    ]) {
      expect((await request(app).get(`/api/orders/export?${query}`).set(auth())).status).toBe(422);
    }
  });
});

/** Mengelompokkan pengujian CRUD data master, laporan, dan filter riwayat. */
describe("master data, reporting and filtering", () => {
  /**
   * Memastikan CRUD produk, kode unik, pagination, pencarian, pengurutan, dan validasi berjalan
   * sesuai kontrak API.
   */
  it("supports product CRUD, unique codes, pagination, search, sorting and validation", async () => {
    const input = { product_code: "P0003", product_name: "Teh", stock: 5, price: "5000.25" };
    const created = await request(app).post("/api/products").set(auth()).send(input);
    expect(created.status).toBe(201);
    const id = created.body.data.id as number;
    expect((await request(app).post("/api/products").set(auth()).send(input)).status).toBe(409);
    expect(
      (
        await request(app)
          .post("/api/products")
          .set(auth())
          .send({ ...input, stock: -1 })
      ).status,
    ).toBe(422);
    expect(
      (
        await request(app)
          .put(`/api/products/${id}`)
          .set(auth())
          .send({ ...input, product_name: "Teh Melati" })
      ).status,
    ).toBe(200);
    const sorted = await request(app).get("/api/products?sort=-price&per_page=1").set(auth());
    expect(sorted.body.data[0].product_name).toBe("Kopi");
    expect(sorted.body.meta).toEqual({ page: 1, per_page: 1, total: 3, total_pages: 3 });
    const search = await request(app).get("/api/products?search=melati").set(auth());
    expect(search.body.data).toHaveLength(1);
    expect((await request(app).delete(`/api/products/${id}`).set(auth())).status).toBe(204);
    expect((await request(app).post("/api/products").set(auth()).send(input)).status).toBe(409);
  });

  /** Memastikan validasi dan alur tambah, ubah, cari, serta hapus pelanggan berjalan benar. */
  it("validates customers and supports create/edit/search/delete", async () => {
    const input = {
      customer_name: "Siti",
      customer_address: "Bandung",
      gender: "Wanita",
      birth_date: "1998-03-10",
      phone: "0812345",
    };
    expect(
      (
        await request(app)
          .post("/api/customers")
          .set(auth())
          .send({ ...input, birth_date: "2999-01-01" })
      ).status,
    ).toBe(422);
    const result = await request(app).post("/api/customers").set(auth()).send(input);
    expect(result.status).toBe(201);
    const id = result.body.data.id as string;
    expect(result.body.data.birth_date).toBe("1998-03-10");
    expect(
      (
        await request(app)
          .put(`/api/customers/${id}`)
          .set(auth())
          .send({ ...input, customer_name: "Siti Aminah" })
      ).status,
    ).toBe(200);
    const found = await request(app).get("/api/customers?search=AMINAH").set(auth());
    expect(found.body.data).toHaveLength(1);
    expect((await request(app).delete(`/api/customers/${id}`).set(auth())).status).toBe(204);
    expect((await request(app).get(`/api/customers/${id}`).set(auth())).status).toBe(404);
  });

  /**
   * Memastikan filter tanggal WIB dan pelanggan cocok dengan hasil riwayat serta agregasi
   * dashboard.
   */
  it("filters history by Indonesia date/customer and calculates dashboard aggregates", async () => {
    await request(app).post("/api/orders").set(auth()).send(order());
    const today = jakartaDay(new Date());
    const history = await request(app)
      .get(`/api/orders?from=${today}&to=${today}&customer_id=${customerId}`)
      .set(auth());
    expect(history.body.meta.total).toBe(1);
    const empty = await request(app).get("/api/orders?to=2000-01-01").set(auth());
    expect(empty.body.meta.total).toBe(0);
    const dashboard = await request(app).get("/api/dashboard/summary").set(auth());
    expect(dashboard.body.data.total_transactions).toBe(1);
    expect(dashboard.body.data.total_sales).toBe("24001.00");
    expect(dashboard.body.data.top_products[0].quantity_sold).toBe(2);
    expect(dashboard.body.data.low_stock_products[0].id).toBe(secondId);
  });
});
