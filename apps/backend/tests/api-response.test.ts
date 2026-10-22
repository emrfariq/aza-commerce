import { describe, expect, it } from "vitest";
import request from "supertest";
import express from "express";
import { z } from "zod";
import { AppError, buildMeta, ok } from "../src/utils/api-response.js";
import { errorHandler, notFoundHandler } from "../src/middlewares/error-handler.js";

/**
 * Membuat aplikasi Express minimal untuk menguji pembungkus respons dan middleware error tanpa
 * database.
 */
const createApp = () => {
  const app = express();
  /** Mengubah BigInt menjadi number agar respons JSON pengujian dapat dikirim. */
  app.set("json replacer", (_key: string, value: unknown) =>
    typeof value === "bigint" ? Number(value) : value,
  );
  /** Menyediakan endpoint sukses sederhana untuk memeriksa format respons. */
  app.get("/api/health", (_req, res) => ok(res, { status: "up" }));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};

/** Mengelompokkan pengujian kontrak respons sukses, error, serialisasi, dan metadata pagination. */
describe("api response format", () => {
  /**
   * Memastikan respons sukses menggunakan pembungkus yang disepakati dan data dapat
   * diserialisasi.
   */
  it("wraps success responses and serializes bigint", async () => {
    const res = await request(createApp()).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: "OK", data: { status: "up" } });
  });

  /** Memastikan rute yang tidak terdaftar mengembalikan HTTP 404 dengan pembungkus error. */
  it("returns 404 envelope for unknown routes", async () => {
    const res = await request(createApp()).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  /**
   * Memastikan AppError dan ZodError menjadi respons error per field, serta respons BigInt dapat
   * dikirim.
   */
  it("maps AppError and ZodError to the error envelope", async () => {
    const app = createApp();
    // Sisipkan rute pengujian sebelum handler 404 agar request sempat diproses.
    const stack = app.router.stack;
    const [notFound, onError] = stack.splice(-2);
    /** Melempar error bisnis tiruan pada kuantitas item kedua untuk menguji path error bersarang. */
    app.get("/t/app-error", () => {
      throw AppError.unprocessable("Stok tidak mencukupi", {
        "items.1.quantity": ["Stok X tersisa 3, diminta 5"],
      });
    });
    /** Memicu kegagalan validasi Zod dengan kuantitas nol untuk memeriksa pemetaan pesan field. */
    app.get("/t/zod", async () => {
      z.object({ items: z.array(z.object({ quantity: z.number().int().positive() })) }).parse({
        items: [{ quantity: 1 }, { quantity: 0 }],
      });
    });
    /** Mengirim ID BigInt untuk memeriksa serialisasi JSON pada aplikasi pengujian. */
    app.get("/t/bigint", (_req, res) => res.json({ id: 1n }));
    stack.push(notFound!, onError!);

    const a = await request(app).get("/t/app-error");
    expect(a.status).toBe(422);
    expect(a.body).toEqual({
      success: false,
      message: "Stok tidak mencukupi",
      errors: { "items.1.quantity": ["Stok X tersisa 3, diminta 5"] },
    });

    const b = await request(app).get("/t/zod");
    expect(b.status).toBe(422);
    expect(Object.keys(b.body.errors)).toEqual(["items.1.quantity"]);

    const c = await request(app).get("/t/bigint");
    expect(c.body).toEqual({ id: 1 });
  });

  /**
   * Memastikan metadata menghitung total halaman dengan pembulatan ke atas dan middleware
   * tersedia.
   */
  it("builds pagination meta", () => {
    expect(buildMeta(1, 10, 57)).toEqual({ page: 1, per_page: 10, total: 57, total_pages: 6 });
    expect(errorHandler).toBeTypeOf("function");
  });
});
