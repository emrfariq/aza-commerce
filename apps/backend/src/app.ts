import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { isAllowedBrowserOrigin } from "./config/env.js";
import { docsRouter } from "./docs/routes.js";
import { requireAuth } from "./middlewares/auth.js";
import { authRouter } from "./modules/auth/routes.js";
import { productsRouter } from "./modules/products/routes.js";
import { customersRouter } from "./modules/customers/routes.js";
import { ordersRouter } from "./modules/orders/routes.js";
import { dashboardRouter } from "./modules/dashboard/routes.js";
import { ok } from "./utils/api-response.js";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler.js";

/**
 * Menyusun aplikasi Express: memasang parser, CORS, dokumentasi, autentikasi, router bisnis,
 * lalu penanganan error. Mengembalikan aplikasi tanpa membuka port agar bisa dipakai juga dalam
 * pengujian.
 */
export const createApp = () => {
  const app = express();

  app.disable("x-powered-by");
  /**
   * Mengubah BigInt menjadi number saat serialisasi JSON karena JSON tidak mendukung BigInt
   * secara langsung.
   */
  app.set("json replacer", (_key: string, value: unknown) =>
    typeof value === "bigint" ? Number(value) : value,
  );
  app.use(
    cors({
      origin:
        /*
         * Meneruskan hasil pemeriksaan origin ke CORS untuk menentukan apakah browser boleh
         * mengakses API.
         */
        (origin, callback) => callback(null, isAllowedBrowserOrigin(origin)),
      credentials: true,
      exposedHeaders: ["Content-Disposition"],
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use(docsRouter);
  app.use("/api/auth", authRouter);
  app.use("/api", requireAuth);

  /**
   * Mengembalikan status layanan; endpoint ini ikut memerlukan autentikasi karena dipasang
   * setelah requireAuth.
   */
  app.get("/api/health", (_req, res) => ok(res, { status: "up" }));
  app.use("/api/products", productsRouter);
  app.use("/api/customers", customersRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/dashboard", dashboardRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};
