import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";

const { PORT: port } = env();
const server = createApp().listen(port, () =>
  console.log(`Backend listening on http://localhost:${port}`),
);
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () =>
    server.close(() => {
      void prisma.$disconnect().then(() => process.exit(0));
    }),
  );
}
