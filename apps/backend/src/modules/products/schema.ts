import { z } from "zod";
import { pagination } from "../../utils/validation.js";

export const productInput = z
  .object({
    product_code: z.string().trim().min(1).max(20),
    product_name: z.string().trim().min(1).max(150),
    stock: z.number().int().min(0).max(2147483647),
    price: z
      .union([z.string(), z.number()])
      .transform(String)
      .refine(
        /*
         * Memastikan harga positif dengan maksimal sepuluh digit sebelum koma dan dua digit
         * desimal.
         */
        (v) => /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(v) && Number(v) > 0,
        "Harga harus positif, maksimal 10 digit dan 2 desimal",
      ),
  })
  .strict();
export const productList = pagination.extend({
  sort: z
    .enum(["product_name", "-product_name", "price", "-price", "stock", "-stock"])
    .default("product_name"),
});
