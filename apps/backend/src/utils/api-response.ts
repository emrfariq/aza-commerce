import type { Response } from "express";

/** Field path -> messages, e.g. { "items.1.quantity": ["Stok ... tersisa 3, diminta 5"] } */
export type FieldErrors = Record<string, string[]>;

export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface SuccessBody<T> {
  success: true;
  message: string;
  data: T;
  meta?: PaginationMeta;
}

export interface ErrorBody {
  success: false;
  message: string;
  errors?: FieldErrors;
}

/** Throw anywhere; error-handler middleware turns it into an ErrorBody. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly errors?: FieldErrors,
  ) {
    super(message);
    this.name = "AppError";
  }

  static notFound(message = "Data tidak ditemukan") {
    return new AppError(404, message);
  }
  static unauthorized(message = "Unauthenticated") {
    return new AppError(401, message);
  }
  static forbidden(message = "Forbidden") {
    return new AppError(403, message);
  }
  static conflict(message: string, errors?: FieldErrors) {
    return new AppError(409, message, errors);
  }
  static unprocessable(message: string, errors?: FieldErrors) {
    return new AppError(422, message, errors);
  }
}

export const buildMeta = (page: number, perPage: number, total: number): PaginationMeta => ({
  page,
  per_page: perPage,
  total,
  total_pages: Math.ceil(total / perPage),
});

export const ok = <T>(res: Response, data: T, message = "OK", meta?: PaginationMeta) =>
  res
    .status(200)
    .json({ success: true, message, data, ...(meta && { meta }) } satisfies SuccessBody<T>);

export const created = <T>(res: Response, data: T, message = "Created") =>
  res.status(201).json({ success: true, message, data } satisfies SuccessBody<T>);

export const noContent = (res: Response) => res.status(204).end();

export const fail = (res: Response, status: number, message: string, errors?: FieldErrors) =>
  res
    .status(status)
    .json({ success: false, message, ...(errors && { errors }) } satisfies ErrorBody);
