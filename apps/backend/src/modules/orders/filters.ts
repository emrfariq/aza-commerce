import type { Prisma } from "@prisma/client";
import { dayStart } from "../../utils/validation.js";
import type { OrderFilters } from "./schema.js";

/**
 * Membentuk filter Prisma yang dipakai bersama oleh daftar dan ekspor order. Tanggal akhir
 * mencakup satu hari penuh di Jakarta dengan batas kurang dari awal hari berikutnya.
 */
export function buildOrderWhere(filters: OrderFilters): Prisma.OrderWhereInput {
  const end = filters.to ? new Date(dayStart(filters.to).getTime() + 86400000) : undefined;
  return {
    customerId: filters.customer_id,
    orderDate: {
      ...(filters.from ? { gte: dayStart(filters.from) } : {}),
      ...(end ? { lt: end } : {}),
    },
  };
}
