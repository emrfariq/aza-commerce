import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../src/lib/prisma.js";

const adminConfig = z.object({
  SEED_ADMIN_NAME: z.string().trim().min(1).max(100).default("Admin"),
  SEED_ADMIN_EMAIL: z
    .string()
    .trim()
    .email()
    .max(150)
    .transform(
      /* Menyeragamkan email admin menjadi huruf kecil sebelum upsert. */ (value) =>
        value.toLowerCase(),
    ),
  SEED_ADMIN_PASSWORD: z
    .string()
    .min(8)
    .refine(
      /*
       * Membatasi password hingga 72 byte UTF-8 sesuai batas masukan bcrypt.
       */
      (value) => Buffer.byteLength(value, "utf8") <= 72,
      "Password seed maksimal 72 byte untuk bcrypt",
    ),
});

/**
 * Memvalidasi konfigurasi admin dari environment lalu membuat akun dengan password bcrypt jika
 * email belum ada. Akun yang sudah ada dipertahankan tanpa mengatur ulang kredensial.
 */
export async function seedAdmin() {
  const config = adminConfig.parse(process.env);
  return prisma.user.upsert({
    where: { email: config.SEED_ADMIN_EMAIL },
    // Menjalankan setup kembali tidak boleh mengatur ulang kredensial admin yang sudah ada.
    update: {},
    create: {
      name: config.SEED_ADMIN_NAME,
      email: config.SEED_ADMIN_EMAIL,
      password: await bcrypt.hash(config.SEED_ADMIN_PASSWORD, 10),
    },
  });
}
