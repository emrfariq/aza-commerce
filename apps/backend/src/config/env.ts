import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  FRONTEND_URL: z.string().url().default("http://localhost:3200"),
  API_PUBLIC_URL: z.string().url().default("http://localhost:4000/api"),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export const env = () => schema.parse(process.env);

/** Only configured application origins may initiate credential-bearing browser requests. */
export function isAllowedBrowserOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  const config = env();
  return origin === config.FRONTEND_URL || origin === new URL(config.API_PUBLIC_URL).origin;
}
