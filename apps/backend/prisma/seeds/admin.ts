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
    .transform((value) => value.toLowerCase()),
  SEED_ADMIN_PASSWORD: z
    .string()
    .min(8)
    .refine(
      (value) => Buffer.byteLength(value, "utf8") <= 72,
      "Password seed maksimal 72 byte untuk bcrypt",
    ),
});

/** Credentials come only from the ignored local environment, never from source defaults. */
export async function seedAdmin() {
  const config = adminConfig.parse(process.env);
  return prisma.user.upsert({
    where: { email: config.SEED_ADMIN_EMAIL },
    // Re-running setup must not silently reset an existing administrator's credentials.
    update: {},
    create: {
      name: config.SEED_ADMIN_NAME,
      email: config.SEED_ADMIN_EMAIL,
      password: await bcrypt.hash(config.SEED_ADMIN_PASSWORD, 10),
    },
  });
}
