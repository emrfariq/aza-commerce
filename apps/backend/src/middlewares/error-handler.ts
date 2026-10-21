import type { ErrorRequestHandler, RequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError, fail, type FieldErrors } from "../utils/api-response.js";

/** Zod issues -> { "items.1.quantity": ["..."] } (path joined with dots, as in the spec). */
export const zodToFieldErrors = (err: ZodError): FieldErrors => {
  const out: FieldErrors = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    (out[key] ??= []).push(issue.message);
  }
  return out;
};

export const notFoundHandler: RequestHandler = (req, res) => {
  fail(res, 404, `Route ${req.method} ${req.path} tidak ditemukan`);
};

// Express 5 forwards rejected async handlers here natively — no asyncHandler wrapper needed.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) return fail(res, err.status, err.message, err.errors);

  if (err instanceof ZodError) return fail(res, 422, "Validasi gagal", zodToFieldErrors(err));

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const fields = ([] as string[]).concat((err.meta?.target as string[] | string | undefined) ?? []);
      const errors = Object.fromEntries(fields.map((f) => [f, [`${f} sudah digunakan`]]));
      return fail(res, 409, "Data duplikat", errors);
    }
    if (err.code === "P2025") return fail(res, 404, "Data tidak ditemukan");
    if (err.code === "P2003") return fail(res, 409, "Data masih direferensikan data lain");
  }

  // Malformed JSON body from express.json()
  if (err?.type === "entity.parse.failed") return fail(res, 400, "Body JSON tidak valid");

  console.error(err);
  return fail(res, 500, "Terjadi kesalahan pada server");
};
