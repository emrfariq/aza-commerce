import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium", viewport: { width: 1440, height: 1000 } } },
  ],
  webServer: [
    {
      name: "Backend",
      command: "pnpm --filter @app/backend run start",
      env: { FRONTEND_URL: "http://localhost:3100" },
      url: "http://localhost:4000/api/health",
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      name: "Frontend",
      command: "pnpm --filter @app/frontend exec next start --port 3100",
      url: "http://localhost:3100/login",
      reuseExistingServer: false,
      timeout: 60000,
    },
  ],
});
