import { z } from "zod";

export const numericId = z.coerce
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER)
  .transform(BigInt);
export const uuid = z.string().uuid("ID pelanggan tidak valid");
export const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(150).default(""),
});

export const dateOnly = z
  .string()
  .regex(/^(?!0000)\d{4}-\d{2}-\d{2}$/, "Gunakan format YYYY-MM-DD (tahun minimal 0001)")
  .refine(
    /*
     * Memeriksa tanggal dengan konversi bolak-balik agar tanggal semu seperti 30 Februari
     * ditolak, bukan dinormalisasi otomatis oleh Date.
     */
    (date) => {
      // Date menormalisasi tanggal tidak valid seperti 30 Februari; cocokkan kembali hasil parsing dengan input.
      const parsed = new Date(`${date}T00:00:00Z`);
      return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === date;
    },
    "Tanggal tidak valid",
  );

/**
 * Mengambil tanggal kalender YYYY-MM-DD menurut WIB dengan menggeser waktu UTC sebanyak tujuh
 * jam.
 */
export function jakartaDay(date: Date): string {
  // Asia/Jakarta memakai UTC+7 tanpa perubahan waktu musim panas.
  return new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Membentuk Date untuk pukul 00.00 WIB pada tanggal yang diberikan sebagai batas awal filter. */
export const dayStart = (day: string) => new Date(`${day}T00:00:00+07:00`);
