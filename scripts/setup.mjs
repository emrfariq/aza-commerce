import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
function ensure(relative, defaults) {
  const path = fileURLToPath(new URL(relative, root));
  const original = existsSync(path) ? readFileSync(path, "utf8") : "";
  const values = parseEnv(original);
  const additions = Object.entries(defaults)
    .filter(([key]) => !values[key])
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join("\n");
  if (additions) writeFileSync(path, `${original.trimEnd()}\n${additions}\n`, "utf8");
  console.log(`Environment ready: ${relative} (existing values preserved)`);
  return parseEnv(`${original}\n${additions}`);
}
const backend = ensure("apps/backend/.env", {
  DATABASE_URL: "postgresql://postgres:password123@localhost:5434/azatech_order_db?schema=public",
  PORT: "4000",
  FRONTEND_URL: "http://localhost:3200",
  NODE_ENV: "development",
  JWT_ACCESS_SECRET: randomBytes(48).toString("hex"),
  JWT_REFRESH_SECRET: randomBytes(48).toString("hex"),
  SEED_ADMIN_NAME: "Admin",
  SEED_ADMIN_EMAIL: "admin@local.test",
  SEED_ADMIN_PASSWORD: randomBytes(18).toString("base64url"),
});
ensure("apps/frontend/.env.local", { NEXT_PUBLIC_API_URL: "http://localhost:4000/api" });
ensure(".env", {
  JWT_ACCESS_SECRET: randomBytes(48).toString("hex"),
  JWT_REFRESH_SECRET: randomBytes(48).toString("hex"),
  SEED_ADMIN_NAME: backend.SEED_ADMIN_NAME,
  SEED_ADMIN_EMAIL: backend.SEED_ADMIN_EMAIL,
  SEED_ADMIN_PASSWORD: backend.SEED_ADMIN_PASSWORD,
});
console.log(
  "Admin credentials are stored locally in apps/backend/.env (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD).",
);
