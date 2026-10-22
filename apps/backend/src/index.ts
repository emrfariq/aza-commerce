import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";

const { PORT: port } = env();
const server = createApp().listen(
  port,
  /* Menampilkan alamat backend setelah server berhasil membuka port. */ () =>
    console.log(`Backend listening on http://localhost:${port}`),
);
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  /**
   * Saat menerima sinyal penghentian, berhenti menerima koneksi baru dan menunggu server
   * ditutup.
   */
  process.on(signal, () =>
    server.close(
      /*
       * Setelah server ditutup, melepaskan koneksi Prisma sebelum mengakhiri proses.
       */
      () => {
        void prisma.$disconnect().then(
          /*
           * Mengakhiri proses dengan kode sukses setelah koneksi database dilepaskan.
           */
          () => process.exit(0),
        );
      },
    ),
  );
}
