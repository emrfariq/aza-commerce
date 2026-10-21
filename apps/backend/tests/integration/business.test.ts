import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { jakartaDay } from "../../src/utils/validation.js";

if (!new URL(process.env.DATABASE_URL!).pathname.endsWith("_test"))
  throw new Error("Integration tests require a _test database");
const app = createApp();
let passwordHash: string;
let token: string;
let customerId: string;
let firstId: number;
let secondId: number;
const auth = () => ({ Authorization: `Bearer ${token}` });
const order = (quantity = 2) => ({
  customer_id: customerId,
  items: [{ product_id: firstId, quantity }],
});

beforeAll(async () => {
  passwordHash = await bcrypt.hash("Test123!", 10);
});
beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    "TRUNCATE TABLE order_items, orders, refresh_tokens, customers, products, users RESTART IDENTITY CASCADE",
  );
  await prisma.user.create({
    data: { email: "admin@test.id", name: "Admin Test", password: passwordHash },
  });
  const customer = await prisma.customer.create({
    data: {
      customerName: "Budi",
      customerAddress: "Jakarta",
      gender: "Pria",
      birthDate: new Date("1995-02-10"),
    },
  });
  customerId = customer.id;
  const first = await prisma.product.create({
    data: { productCode: "P0001", productName: "Hydrococo", stock: 10, price: "12000.50" },
  });
  const second = await prisma.product.create({
    data: { productCode: "P0002", productName: "Kopi", stock: 3, price: "15000.25" },
  });
  firstId = Number(first.id);
  secondId = Number(second.id);
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: "admin@test.id", password: "Test123!" });
  expect(login.status).toBe(200);
  token = login.body.data.access_token as string;
});
afterAll(() => prisma.$disconnect());

describe("orders: real PostgreSQL transactions", () => {
  it("creates a multi-item order, snapshots prices and calculates exact totals on the server", async () => {
    const result = await request(app)
      .post("/api/orders")
      .set(auth())
      .send({
        customer_id: customerId,
        items: [
          { product_id: firstId, quantity: 2 },
          { product_id: secondId, quantity: 1 },
        ],
      });
    expect(result.status).toBe(201);
    expect(result.body.data.total_amount).toBe("39001.25");
    expect(result.body.data.items[0].unit_price).toBe("12000.50");
    expect(result.body.data.items[0].product.stock).toBe(8);
    expect(result.body.data.order_number).toMatch(/^INV-\d{8}-0001$/);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: BigInt(firstId) } })).stock).toBe(
      8,
    );
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: BigInt(secondId) } })).stock,
    ).toBe(2);
    expect(await prisma.orderItem.count()).toBe(2);
  });

  it("rolls back the entire order when its second item has insufficient stock", async () => {
    const result = await request(app)
      .post("/api/orders")
      .set(auth())
      .send({
        customer_id: customerId,
        items: [
          { product_id: firstId, quantity: 2 },
          { product_id: secondId, quantity: 5 },
        ],
      });
    expect(result.status).toBe(422);
    expect(result.body.errors["items.1.quantity"][0]).toContain("tersisa 3");
    expect(await prisma.order.count()).toBe(0);
    expect(await prisma.orderItem.count()).toBe(0);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: BigInt(firstId) } })).stock).toBe(
      10,
    );
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: BigInt(secondId) } })).stock,
    ).toBe(3);
  });

  it("rejects invalid quantities, duplicate items, an empty cart and client-supplied prices", async () => {
    for (const body of [
      order(0),
      { ...order(), price: 1 },
      { ...order(), items: [] },
      { ...order(), items: [{ product_id: firstId, quantity: 1, price: 1 }] },
      {
        ...order(),
        items: [
          { product_id: firstId, quantity: 1 },
          { product_id: firstId, quantity: 1 },
        ],
      },
    ]) {
      const result = await request(app).post("/api/orders").set(auth()).send(body);
      expect(result.status).toBe(422);
      expect(result.body.success).toBe(false);
    }
    expect(await prisma.order.count()).toBe(0);
  });

  it("prevents overselling when simultaneous requests compete for the last stock", async () => {
    await prisma.product.update({ where: { id: BigInt(firstId) }, data: { stock: 1 } });
    const results = await Promise.all(
      [1, 2].map(() => request(app).post("/api/orders").set(auth()).send(order(1))),
    );
    expect(results.map((result) => result.status).sort()).toEqual([201, 422]);
    expect(await prisma.order.count()).toBe(1);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: BigInt(firstId) } })).stock).toBe(
      0,
    );
  });

  it("allocates distinct sequential numbers for concurrent orders on different products", async () => {
    const results = await Promise.all(
      [firstId, secondId].map((id) =>
        request(app)
          .post("/api/orders")
          .set(auth())
          .send({ customer_id: customerId, items: [{ product_id: id, quantity: 1 }] }),
      ),
    );
    expect(results.map((result) => result.status)).toEqual([201, 201]);
    expect(new Set(results.map((result) => result.body.data.order_number)).size).toBe(2);
  });

  it("preserves snapshot prices and history after product/customer changes and soft deletion", async () => {
    const result = await request(app).post("/api/orders").set(auth()).send(order());
    const id = result.body.data.id as number;
    await prisma.product.update({ where: { id: BigInt(firstId) }, data: { price: "99000.00" } });
    expect((await request(app).delete(`/api/products/${firstId}`).set(auth())).status).toBe(204);
    expect((await request(app).delete(`/api/customers/${customerId}`).set(auth())).status).toBe(
      204,
    );
    const detail = await request(app).get(`/api/orders/${id}`).set(auth());
    expect(detail.status).toBe(200);
    expect(detail.body.data.total_amount).toBe("24001.00");
    expect(detail.body.data.items[0].unit_price).toBe("12000.50");
    expect(detail.body.data.items[0].product.product_name).toBe("Hydrococo");
    expect(detail.body.data.customer.customer_name).toBe("Budi");
    expect((await request(app).post("/api/orders").set(auth()).send(order())).status).toBe(422);
    expect((await request(app).get(`/api/products/${firstId}`).set(auth())).status).toBe(404);
  });
});

describe("authentication and input boundaries", () => {
  it("rejects requests without a token, invalid tokens and expired tokens", async () => {
    for (const path of [
      "/api/products",
      "/api/customers",
      "/api/orders",
      "/api/dashboard/summary",
      "/api/auth/me",
      "/api/health",
    ]) {
      expect((await request(app).get(path)).status).toBe(401);
    }
    const expired = jwt.sign(
      { sub: "1", sid: "1", kind: "access" },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: -1, issuer: "azatech-order-api", audience: "azatech-admin" },
    );
    for (const value of ["bad-token", expired])
      expect(
        (await request(app).get("/api/products").set("Authorization", `Bearer ${value}`)).status,
      ).toBe(401);
  });

  it("rotates refresh tokens and revokes both refresh and access credentials on logout", async () => {
    const agent = request.agent(app);
    const login = await agent
      .post("/api/auth/login")
      .send({ email: "admin@test.id", password: "Test123!" });
    const oldCookie = (login.headers["set-cookie"] as unknown as string[])[0]!.split(";")[0]!;
    const refreshed = await agent.post("/api/auth/refresh");
    expect(refreshed.status).toBe(200);
    expect((await request(app).post("/api/auth/refresh").set("Cookie", oldCookie)).status).toBe(
      401,
    );
    const access = refreshed.body.data.access_token as string;
    expect(
      (await agent.post("/api/auth/logout").set("Authorization", `Bearer ${access}`)).status,
    ).toBe(200);
    expect(
      (await request(app).get("/api/auth/me").set("Authorization", `Bearer ${access}`)).status,
    ).toBe(401);
    expect((await agent.post("/api/auth/refresh")).status).toBe(401);
  });

  it("returns consistent errors for invalid login, dates, malformed JSON and unknown resources", async () => {
    expect(
      (
        await request(app)
          .post("/api/auth/login")
          .send({ email: "admin@test.id", password: "wrong" })
      ).status,
    ).toBe(401);
    expect((await request(app).get("/api/orders?from=2026-02-30").set(auth())).status).toBe(422);
    expect(
      (await request(app).get("/api/orders?from=2026-03-01&to=2026-02-01").set(auth())).status,
    ).toBe(422);
    expect((await request(app).get("/api/orders/99999").set(auth())).status).toBe(404);
    expect((await request(app).get("/api/products/9007199254740992").set(auth())).status).toBe(422);
    const malformed = await request(app)
      .post("/api/products")
      .set(auth())
      .set("Content-Type", "application/json")
      .send("{broken");
    expect(malformed.status).toBe(400);
    expect(malformed.body.success).toBe(false);
  });
});

describe("master data, reporting and filtering", () => {
  it("supports product CRUD, unique codes, pagination, search, sorting and validation", async () => {
    const input = { product_code: "P0003", product_name: "Teh", stock: 5, price: "5000.25" };
    const created = await request(app).post("/api/products").set(auth()).send(input);
    expect(created.status).toBe(201);
    const id = created.body.data.id as number;
    expect((await request(app).post("/api/products").set(auth()).send(input)).status).toBe(409);
    expect(
      (
        await request(app)
          .post("/api/products")
          .set(auth())
          .send({ ...input, stock: -1 })
      ).status,
    ).toBe(422);
    expect(
      (
        await request(app)
          .put(`/api/products/${id}`)
          .set(auth())
          .send({ ...input, product_name: "Teh Melati" })
      ).status,
    ).toBe(200);
    const sorted = await request(app).get("/api/products?sort=-price&per_page=1").set(auth());
    expect(sorted.body.data[0].product_name).toBe("Kopi");
    expect(sorted.body.meta).toEqual({ page: 1, per_page: 1, total: 3, total_pages: 3 });
    const search = await request(app).get("/api/products?search=melati").set(auth());
    expect(search.body.data).toHaveLength(1);
    expect((await request(app).delete(`/api/products/${id}`).set(auth())).status).toBe(204);
    expect((await request(app).post("/api/products").set(auth()).send(input)).status).toBe(409);
  });

  it("validates customers and supports create/edit/search/delete", async () => {
    const input = {
      customer_name: "Siti",
      customer_address: "Bandung",
      gender: "Wanita",
      birth_date: "1998-03-10",
      phone: "0812345",
    };
    expect(
      (
        await request(app)
          .post("/api/customers")
          .set(auth())
          .send({ ...input, birth_date: "2999-01-01" })
      ).status,
    ).toBe(422);
    const result = await request(app).post("/api/customers").set(auth()).send(input);
    expect(result.status).toBe(201);
    const id = result.body.data.id as string;
    expect(result.body.data.birth_date).toBe("1998-03-10");
    expect(
      (
        await request(app)
          .put(`/api/customers/${id}`)
          .set(auth())
          .send({ ...input, customer_name: "Siti Aminah" })
      ).status,
    ).toBe(200);
    const found = await request(app).get("/api/customers?search=AMINAH").set(auth());
    expect(found.body.data).toHaveLength(1);
    expect((await request(app).delete(`/api/customers/${id}`).set(auth())).status).toBe(204);
    expect((await request(app).get(`/api/customers/${id}`).set(auth())).status).toBe(404);
  });

  it("filters history by Indonesia date/customer and calculates dashboard aggregates", async () => {
    await request(app).post("/api/orders").set(auth()).send(order());
    const today = jakartaDay(new Date());
    const history = await request(app)
      .get(`/api/orders?from=${today}&to=${today}&customer_id=${customerId}`)
      .set(auth());
    expect(history.body.meta.total).toBe(1);
    const empty = await request(app).get("/api/orders?to=2000-01-01").set(auth());
    expect(empty.body.meta.total).toBe(0);
    const dashboard = await request(app).get("/api/dashboard/summary").set(auth());
    expect(dashboard.body.data.total_transactions).toBe(1);
    expect(dashboard.body.data.total_sales).toBe("24001.00");
    expect(dashboard.body.data.top_products[0].quantity_sold).toBe(2);
    expect(dashboard.body.data.low_stock_products[0].id).toBe(secondId);
  });
});
