import { prisma } from "../src/lib/prisma.js";
import { seedAdmin } from "./seeds/admin.js";

seedAdmin()
  .then(() =>
    console.log(
      "Admin seed ready. Credentials are configured in the local environment; existing accounts are preserved.",
    ),
  )
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
