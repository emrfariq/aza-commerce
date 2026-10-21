import express from "express";
import { ok } from "./utils/api-response.js";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler.js";

export const createApp = () => {
  const app = express();

  // BigInt ids (bigint PKs) are not JSON-serializable by default.
  // ponytail: Number() is safe below 2^53; switch to String() if ids ever get that big.
  app.set("json replacer", (_key: string, value: unknown) =>
    typeof value === "bigint" ? Number(value) : value,
  );
  app.use(express.json());

  app.get("/api/health", (_req, res) => ok(res, { status: "up" }));
  // Feature routers are mounted here in Phase 2.

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};
