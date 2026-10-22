import type { ErrorRequestHandler, RequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError, fail, type FieldErrors } from "../utils/api-response.js";

/**
 * Mengelompokkan pesan validasi Zod berdasarkan path field, misalnya items.1.quantity, agar
 * frontend bisa menampilkan error pada input yang tepat.
 */
export const zodToFieldErrors = (err: ZodError): FieldErrors => {
  const out: FieldErrors = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    (out[key] ??= []).push(issue.message);
  }
  return out;
};

/** Mengembalikan respons 404 yang seragam saat tidak ada router yang cocok dengan request. */
export const notFoundHandler: RequestHandler = (req, res) => {
  fail(res, 404, `Route ${req.method} ${req.path} tidak ditemukan`);
};

// Express 5 meneruskan kegagalan handler async ke middleware ini secara otomatis tanpa pembungkus tambahan.
/**
 * Mengubah error aplikasi, Zod, Prisma, dan parser JSON menjadi respons HTTP yang seragam. Error
 * tak dikenal dicatat di server dan dikirim sebagai 500 tanpa membocorkan detail internal.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) return fail(res, err.status, err.message, err.errors);

  if (err instanceof ZodError) return fail(res, 422, "Validasi gagal", zodToFieldErrors(err));

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const fields = ([] as string[]).concat(
        (err.meta?.target as string[] | string | undefined) ?? [],
      );
      const errors = Object.fromEntries(
        fields.map(
          /*
           * Mengubah nama field unik dari Prisma menjadi pasangan nama field dan pesan
           * duplikasi untuk respons 409.
           */
          (f) => {
            const name = f.replace(
              /[A-Z]/g,
              /*
               * Mengubah huruf kapital menjadi garis bawah dan huruf kecil agar nama field
               * memakai snake_case.
               */
              (c) => `_${c.toLowerCase()}`,
            );
            return [name, [`${name} sudah digunakan`]];
          },
        ),
      );
      return fail(res, 409, "Data duplikat", errors);
    }
    if (err.code === "P2025") return fail(res, 404, "Data tidak ditemukan");
    if (err.code === "P2003") return fail(res, 409, "Data masih direferensikan data lain");
  }

  // Tangani body JSON rusak dari express.json().
  if (err?.type === "entity.parse.failed") return fail(res, 400, "Body JSON tidak valid");
  if (err?.type === "entity.too.large") return fail(res, 413, "Request terlalu besar");

  console.error(err);
  return fail(res, 500, "Terjadi kesalahan pada server");
};
