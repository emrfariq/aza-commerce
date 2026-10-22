import { z } from "zod";
import { dateOnly, jakartaDay } from "../../utils/validation.js";

export const customerInput = z
  .object({
    customer_name: z.string().trim().min(1).max(150),
    customer_address: z.string().trim().min(1).max(255),
    gender: z.enum(["Pria", "Wanita"]),
    birth_date: dateOnly.refine(
      /*
       * Menolak tanggal lahir yang melewati tanggal hari ini menurut zona waktu Jakarta.
       */
      (v) => v <= jakartaDay(new Date()),
      "Tanggal lahir tidak boleh di masa depan",
    ),
    phone: z.string().trim().max(20).nullable().optional(),
  })
  .strict();
