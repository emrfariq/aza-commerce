import { prisma } from "../src/lib/prisma.js";
import { seedAdmin } from "./seeds/admin.js";

/** Menutup koneksi Prisma setelah proses penyiapan admin berakhir. */
seedAdmin()
  .then(
    /*
     * Menampilkan pesan selesai setelah admin berhasil disiapkan dari konfigurasi lokal.
     */
    () =>
      console.log(
        "Admin seed ready. Credentials are configured in the local environment; existing accounts are preserved.",
      ),
  )
  .catch(
    /* Mencatat error pembuatan admin dan memberikan kode keluar gagal. */ (error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    },
  )
  .finally(() => prisma.$disconnect());
