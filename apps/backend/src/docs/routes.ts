import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import { openApiDocument } from "./openapi.js";

export const docsRouter = Router();

// Dokumentasi dapat dibaca sebelum login; router bisnis tetap dilindungi requireAuth.
/**
 * Menyajikan spesifikasi OpenAPI dalam JSON agar dapat dibaca Swagger atau alat pengujian API
 * tanpa login.
 */
docsRouter.get("/api/openapi.json", (_req, res) => res.json(openApiDocument));
docsRouter.use(
  "/api/docs",
  swaggerUi.serve,
  swaggerUi.setup(openApiDocument, {
    customSiteTitle: "Aza Commerce — Swagger API",
    swaggerOptions: {
      withCredentials: true,
      persistAuthorization: false,
      validatorUrl: null,
      displayRequestDuration: true,
      docExpansion: "list",
      filter: true,
    },
  }),
);
/** Mengarahkan alamat utama backend ke halaman dokumentasi Swagger. */
docsRouter.get("/", (_req, res) => res.redirect("/api/docs/"));
