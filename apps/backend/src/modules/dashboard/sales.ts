import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { dayStart, jakartaDay } from "../../utils/validation.js";

export const dailySalesQuery = z.object({
  days: z.coerce.number().int().min(1).max(366).default(30),
});

export async function dailySales(days: number) {
  const to = jakartaDay(new Date());
  const start = new Date(dayStart(to).getTime() - (days - 1) * 86400000);
  const end = new Date(dayStart(to).getTime() + 86400000);
  const from = jakartaDay(start);
  // Explicit timezone grouping is independent of the database or container's timezone.
  const rows = await prisma.$queryRaw<
    { date: string; total_transactions: number; total_sales: Prisma.Decimal }[]
  >`
    SELECT (order_date AT TIME ZONE 'Asia/Jakarta')::date::text AS date,
           COUNT(*)::integer AS total_transactions, SUM(total_amount) AS total_sales
    FROM orders
    WHERE order_date >= ${start} AND order_date < ${end}
    GROUP BY 1 ORDER BY 1
  `;
  const byDay = new Map(rows.map((row) => [row.date, row]));
  const series = Array.from({ length: days }, (_, index) => {
    const date = jakartaDay(new Date(start.getTime() + index * 86400000));
    const row = byDay.get(date);
    return {
      date,
      totalTransactions: row?.total_transactions ?? 0,
      totalSales: row?.total_sales ?? new Prisma.Decimal(0),
    };
  });
  return {
    from,
    to,
    totalTransactions: series.reduce((sum, day) => sum + day.totalTransactions, 0),
    totalSales: series.reduce((sum, day) => sum.add(day.totalSales), new Prisma.Decimal(0)),
    series,
  };
}
