import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";

// The runner creates a separate database, applies real migrations, then starts Vitest.
const require = createRequire(import.meta.url);
const e2e = process.argv.includes("--e2e");
const base = new URL(process.env.DATABASE_URL!);
const override = e2e ? process.env.E2E_DATABASE_URL : process.env.TEST_DATABASE_URL;
const target = override ? new URL(override) : new URL(base);
if (!override) target.pathname = `${base.pathname}${e2e ? "_e2e" : ""}_test`;
const name = target.pathname.slice(1);
if (!/^[a-zA-Z0-9_]+_test$/.test(name) || target.href === base.href) {
  throw new Error("Test database must be separate and its name must end with _test");
}
const adminUrl = new URL(target);
adminUrl.pathname = "/postgres";
const admin = new PrismaClient({ datasources: { db: { url: adminUrl.href } } });
try {
  const found = await admin.$queryRaw<
    { datname: string }[]
  >`SELECT datname FROM pg_database WHERE datname = ${name}`;
  if (!found.length) await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
} finally {
  await admin.$disconnect();
}
const testEnv = {
  ...process.env,
  DATABASE_URL: target.href,
  NODE_ENV: "test",
  JWT_ACCESS_SECRET: "integration-test-access-secret-at-least-32-chars",
  JWT_REFRESH_SECRET: "integration-test-refresh-secret-at-least-32-chars",
};
const commands: [string, string[]][] = [
  [require.resolve("prisma/build/index.js"), ["migrate", "deploy"]],
];
if (e2e) {
  commands.push([require.resolve("tsx/cli"), ["prisma/seed.ts"]]);
  commands.push([
    require.resolve("@playwright/test/cli"),
    ["test", "--config", "../../playwright.config.ts"],
  ]);
} else commands.push([require.resolve("vitest/vitest.mjs"), ["run"]]);
for (const [cli, args] of commands) {
  const result = spawnSync(process.execPath, [cli, ...args], { env: testEnv, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
