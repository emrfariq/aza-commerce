import type { Response } from "express";

/** Memetakan path field ke daftar pesan, misalnya { "items.1.quantity": ["Stok ... tersisa 3, diminta 5"] } */
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

/** Dapat dilempar dari lapisan aplikasi; middleware error mengubahnya menjadi ErrorBody. */
export class AppError extends Error {
  /**
   * Membuat error aplikasi yang membawa status HTTP, pesan, dan detail kesalahan field untuk
   * diproses middleware error.
   */
  constructor(
    public readonly status: number,
    message: string,
    public readonly errors?: FieldErrors,
  ) {
    super(message);
    this.name = "AppError";
  }

  /** Membuat error 404 untuk resource yang tidak ditemukan. */
  static notFound(message = "Data tidak ditemukan") {
    return new AppError(404, message);
  }
  /** Membuat error 401 saat identitas pengguna belum terverifikasi atau sesi tidak berlaku. */
  static unauthorized(message = "Unauthenticated") {
    return new AppError(401, message);
  }
  /** Membuat error 403 ketika akses tidak diizinkan. */
  static forbidden(message = "Forbidden") {
    return new AppError(403, message);
  }
  /** Membuat error 409 untuk konflik data atau transaksi, dengan detail field bila tersedia. */
  static conflict(message: string, errors?: FieldErrors) {
    return new AppError(409, message, errors);
  }
  /** Membuat error 422 untuk input atau aturan bisnis yang tidak terpenuhi. */
  static unprocessable(message: string, errors?: FieldErrors) {
    return new AppError(422, message, errors);
  }
}

/**
 * Menghitung metadata pagination dari halaman, ukuran halaman, dan total data; jumlah halaman
 * dibulatkan ke atas.
 */
export const buildMeta = (page: number, perPage: number, total: number): PaginationMeta => ({
  page,
  per_page: perPage,
  total,
  total_pages: Math.ceil(total / perPage),
});

/** Mengirim respons sukses HTTP 200 dengan pembungkus data yang seragam dan metadata opsional. */
export const ok = <T>(res: Response, data: T, message = "OK", meta?: PaginationMeta) =>
  res
    .status(200)
    .json({ success: true, message, data, ...(meta && { meta }) } satisfies SuccessBody<T>);

/** Mengirim respons HTTP 201 untuk resource yang berhasil dibuat. */
export const created = <T>(res: Response, data: T, message = "Created") =>
  res.status(201).json({ success: true, message, data } satisfies SuccessBody<T>);

/** Mengakhiri respons HTTP 204 tanpa body, misalnya setelah penghapusan berhasil. */
export const noContent = (res: Response) => res.status(204).end();

/**
 * Mengirim respons gagal dengan status, pesan, dan detail field opsional dalam format yang
 * seragam.
 */
export const fail = (res: Response, status: number, message: string, errors?: FieldErrors) =>
  res
    .status(status)
    .json({ success: false, message, ...(errors && { errors }) } satisfies ErrorBody);
