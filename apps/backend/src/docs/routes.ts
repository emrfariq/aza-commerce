import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import { openApiDocument } from "./openapi.js";

export const docsRouter = Router();

// Documentation is readable before login; business routers still use requireAuth.
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
docsRouter.get("/", (_req, res) => res.redirect("/api/docs/"));
