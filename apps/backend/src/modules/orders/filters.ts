import type { Prisma } from "@prisma/client";
import { dayStart } from "../../utils/validation.js";
import type { OrderFilters } from "./schema.js";

/** List and export deliberately share the same inclusive Jakarta date boundaries. */
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
