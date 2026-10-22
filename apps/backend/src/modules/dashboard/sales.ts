import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { dayStart, jakartaDay } from "../../utils/validation.js";

export const dailySalesQuery = z.object({
  days: z.coerce.number().int().min(1).max(366).default(30),
});

/**
 * Mengagregasi penjualan per tanggal Jakarta selama jumlah hari yang diminta, termasuk hari ini.
 * Hari tanpa transaksi diisi nol, lalu seluruh seri dijumlahkan memakai Decimal agar nominal
 * tetap presisi.
 */
export async function dailySales(days: number) {
  const to = jakartaDay(new Date());
  const start = new Date(dayStart(to).getTime() - (days - 1) * 86400000);
  const end = new Date(dayStart(to).getTime() + 86400000);
  const from = jakartaDay(start);
  // Pengelompokan memakai zona Jakarta secara eksplisit agar tidak bergantung pada zona waktu database atau container.
  const rows = await prisma.$queryRaw<
    { date: string; total_transactions: number; total_sales: Prisma.Decimal }[]
  >`
    SELECT (order_date AT TIME ZONE 'Asia/Jakarta')::date::text AS date,
           COUNT(*)::integer AS total_transactions, SUM(total_amount) AS total_sales
    FROM orders
    WHERE order_date >= ${start} AND order_date < ${end}
    GROUP BY 1 ORDER BY 1
  `;
  const byDay = new Map(
    rows.map(
      /*
       * Membuat pasangan tanggal dan hasil agregasi agar data harian dapat dicari melalui
       * Map.
       */
      (row) => [row.date, row],
    ),
  );
  const series = Array.from(
    { length: days },
    /*
     * Membentuk satu titik data per hari; menggunakan nol jika tanggal tersebut tidak
     * memiliki transaksi.
     */
    (_, index) => {
      const date = jakartaDay(new Date(start.getTime() + index * 86400000));
      const row = byDay.get(date);
      return {
        date,
        totalTransactions: row?.total_transactions ?? 0,
        totalSales: row?.total_sales ?? new Prisma.Decimal(0),
      };
    },
  );
  return {
    from,
    to,
    totalTransactions: series.reduce(
      /*
       * Menjumlahkan banyaknya transaksi dari seluruh hari dalam periode laporan.
       */
      (sum, day) => sum + day.totalTransactions,
      0,
    ),
    totalSales: series.reduce(
      /*
       * Menjumlahkan nominal penjualan dengan operasi Decimal untuk menghindari galat
       * pecahan floating-point.
       */
      (sum, day) => sum.add(day.totalSales),
      new Prisma.Decimal(0),
    ),
    series,
  };
}
