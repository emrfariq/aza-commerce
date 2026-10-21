import { z } from "zod";
import { dateOnly, pagination, uuid } from "../../utils/validation.js";

export const orderInput = z
  .object({
    customer_id: uuid,
    items: z
      .array(
        z
          .object({
            product_id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
            quantity: z.number().int().positive().max(2147483647),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict()
  .superRefine((input, ctx) => {
    const seen = new Set<number>();
    input.items.forEach((item, index) => {
      if (seen.has(item.product_id))
        ctx.addIssue({
          code: "custom",
          path: ["items", index, "product_id"],
          message: "Produk sudah dipilih pada baris lain",
        });
      seen.add(item.product_id);
    });
  });
export type OrderInput = z.infer<typeof orderInput>;
const filterFields = {
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  customer_id: uuid.optional(),
};
const validDateRange = (q: { from?: string; to?: string }) => !q.from || !q.to || q.from <= q.to;
const dateRangeError = {
  message: "Tanggal awal harus sebelum tanggal akhir",
  path: ["to"],
};
export const orderList = pagination.extend(filterFields).refine(validDateRange, dateRangeError);
export const orderExport = z
  .object({
    ...filterFields,
    format: z.enum(["csv", "xlsx"]).default("csv"),
  })
  .refine(validDateRange, dateRangeError);
export type OrderFilters = Pick<z.infer<typeof orderExport>, "from" | "to" | "customer_id">;
