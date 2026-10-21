import { describe, expect, it } from "vitest";
import request from "supertest";
import SwaggerParser from "@apidevtools/swagger-parser";
import { createApp } from "../src/app.js";
import { openApiDocument } from "../src/docs/openapi.js";

describe("Swagger and OpenAPI documentation", () => {
  it("validates schemas, references, and all 21 implemented API operations", async () => {
    // Parser dereferences in place; keep the source contract and server response unchanged.
    await SwaggerParser.validate(structuredClone(openApiDocument));
    const operations = Object.entries(openApiDocument.paths).flatMap(([path, item]) =>
      Object.keys(item ?? {})
        .filter((method) => ["get", "post", "put", "delete"].includes(method))
        .map((method) => `${method.toUpperCase()} ${path}`),
    );
    expect(operations.sort()).toEqual(
      [
        "POST /auth/login",
        "POST /auth/refresh",
        "POST /auth/logout",
        "GET /auth/me",
        "GET /health",
        "GET /products",
        "POST /products",
        "GET /products/{id}",
        "PUT /products/{id}",
        "DELETE /products/{id}",
        "GET /customers",
        "POST /customers",
        "GET /customers/{id}",
        "PUT /customers/{id}",
        "DELETE /customers/{id}",
        "GET /orders",
        "POST /orders",
        "GET /orders/{id}",
        "GET /orders/export",
        "GET /dashboard/summary",
        "GET /dashboard/daily-sales",
      ].sort(),
    );
    expect(openApiDocument.security).toEqual([{ bearerAuth: [] }]);
    expect(openApiDocument.paths["/auth/login"]?.post?.security).toEqual([]);
    expect(openApiDocument.paths["/auth/refresh"]?.post?.security).toEqual([{ refreshCookie: [] }]);
  });

  it("serves public Swagger HTML, local assets, and raw OpenAPI JSON from the backend", async () => {
    const app = createApp();
    const home = await request(app).get("/");
    expect(home.status).toBe(302);
    expect(home.headers.location).toBe("/api/docs/");
    const ui = await request(app).get("/api/docs/");
    expect(ui.status).toBe(200);
    expect(ui.text).toContain("Aza Commerce — Swagger API");
    const asset = await request(app).get("/api/docs/swagger-ui.css");
    expect(asset.status).toBe(200);
    expect(asset.headers["content-type"]).toContain("text/css");
    const spec = await request(app).get("/api/openapi.json");
    expect(spec.status).toBe(200);
    expect(spec.body.openapi).toBe("3.0.3");
    expect(
      spec.body.paths["/orders"].post.requestBody.content["application/json"].examples
        .insufficientStock,
    ).toBeDefined();
  });

  it("keeps business endpoints protected when documentation is publicly accessible", async () => {
    for (const path of [
      "/api/auth/me",
      "/api/products",
      "/api/customers",
      "/api/orders",
      "/api/dashboard/summary",
      "/api/dashboard/daily-sales",
      "/api/orders/export",
      "/api/health",
    ]) {
      expect((await request(createApp()).get(path)).status).toBe(401);
    }
  });
});
