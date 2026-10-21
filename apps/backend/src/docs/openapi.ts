import type { OpenAPIV3 } from "openapi-types";

type Schema = OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject;
const schemaRef = (name: string): OpenAPIV3.ReferenceObject => ({
  $ref: `#/components/schemas/${name}`,
});
const parameterRef = (name: string): OpenAPIV3.ReferenceObject => ({
  $ref: `#/components/parameters/${name}`,
});
const responseRef = (name: string): OpenAPIV3.ReferenceObject => ({
  $ref: `#/components/responses/${name}`,
});
const nullableTimestamp: OpenAPIV3.SchemaObject = {
  type: "string",
  format: "date-time",
  nullable: true,
};
const timestamps: Record<string, Schema> = {
  created_at: { type: "string", format: "date-time" },
  updated_at: { type: "string", format: "date-time" },
};
const id: OpenAPIV3.SchemaObject = {
  type: "integer",
  format: "int64",
  minimum: 1,
  maximum: Number.MAX_SAFE_INTEGER,
  example: 1,
};
const productFields: Record<string, Schema> = {
  product_code: { type: "string", minLength: 1, maxLength: 20, example: "P0001" },
  product_name: { type: "string", minLength: 1, maxLength: 150, example: "Hydrococo 150ml" },
  stock: { type: "integer", minimum: 0, maximum: 2147483647, example: 10 },
  price: schemaRef("PriceInput"),
};
const customerFields: Record<string, Schema> = {
  customer_name: { type: "string", minLength: 1, maxLength: 150, example: "Budi Santoso" },
  customer_address: { type: "string", minLength: 1, maxLength: 255, example: "Jakarta" },
  gender: { type: "string", enum: ["Pria", "Wanita"] },
  birth_date: {
    type: "string",
    format: "date",
    example: "1995-02-10",
    description: "Tanggal kalender valid, tidak di masa depan.",
  },
  phone: { type: "string", nullable: true, maxLength: 20, example: "081234567890" },
};
const orderFields: Record<string, Schema> = {
  id,
  order_number: {
    type: "string",
    maxLength: 30,
    pattern: "^INV-\\d{8}-\\d{4}$",
    example: "INV-20261021-0001",
  },
  customer_id: { type: "string", format: "uuid" },
  created_by: id,
  order_date: { type: "string", format: "date-time" },
  total_amount: schemaRef("Money"),
  ...timestamps,
};

function envelope(data: Schema, paginated = false): OpenAPIV3.SchemaObject {
  return {
    type: "object",
    required: ["success", "message", "data", ...(paginated ? ["meta"] : [])],
    properties: {
      success: { type: "boolean", enum: [true] },
      message: { type: "string", example: "OK" },
      data,
      ...(paginated ? { meta: schemaRef("PaginationMeta") } : {}),
    },
  };
}

function jsonResponse(schema: Schema, description = "Berhasil"): OpenAPIV3.ResponseObject {
  return { description, content: { "application/json": { schema } } };
}

function requestBody(schema: string): OpenAPIV3.RequestBodyObject {
  return { required: true, content: { "application/json": { schema: schemaRef(schema) } } };
}

const protectedErrors: OpenAPIV3.ResponsesObject = {
  "401": responseRef("Unauthorized"),
  "500": responseRef("InternalError"),
};
const bodyErrors: OpenAPIV3.ResponsesObject = {
  "400": responseRef("MalformedJson"),
  "413": responseRef("PayloadTooLarge"),
  "422": responseRef("ValidationError"),
};

function masterPaths(
  resource: "products" | "customers",
  tag: string,
  model: "Product" | "Customer",
): OpenAPIV3.PathsObject {
  const params = [parameterRef("Page"), parameterRef("PerPage"), parameterRef("Search")];
  if (resource === "products") params.push(parameterRef("ProductSort"));
  const idParameter = parameterRef(resource === "products" ? "NumericId" : "CustomerUuid");
  return {
    [`/${resource}`]: {
      get: {
        tags: [tag],
        operationId: `list${tag}`,
        summary: `Daftar ${resource === "products" ? "produk" : "pelanggan"}`,
        description:
          resource === "products"
            ? "Pagination, pencarian nama/kode, dan sort nama/harga/stok. Hanya produk aktif."
            : "Pagination dan pencarian nama (case-insensitive). Hanya pelanggan aktif.",
        parameters: params,
        responses: {
          "200": jsonResponse(schemaRef(`${model}ListResponse`)),
          "422": responseRef("ValidationError"),
          ...protectedErrors,
        },
      },
      post: {
        tags: [tag],
        operationId: `create${model}`,
        summary: `Tambah ${resource === "products" ? "produk" : "pelanggan"}`,
        requestBody: requestBody(`${model}Input`),
        responses: {
          "201": jsonResponse(envelope(schemaRef(model)), "Resource dibuat"),
          ...bodyErrors,
          ...(resource === "products" ? { "409": responseRef("Conflict") } : {}),
          ...protectedErrors,
        },
      },
    },
    [`/${resource}/{id}`]: {
      parameters: [idParameter],
      get: {
        tags: [tag],
        operationId: `get${model}`,
        summary: `Detail ${resource === "products" ? "produk" : "pelanggan"} aktif`,
        responses: {
          "200": jsonResponse(envelope(schemaRef(model))),
          "404": responseRef("NotFound"),
          "422": responseRef("ValidationError"),
          ...protectedErrors,
        },
      },
      put: {
        tags: [tag],
        operationId: `update${model}`,
        summary: `Edit ${resource === "products" ? "produk" : "pelanggan"}`,
        description:
          resource === "products"
            ? "Semua editable fields wajib. stock adalah penyesuaian absolut oleh admin. Kode produk tetap reserved setelah soft delete."
            : "Semua editable fields wajib kecuali phone. Resource yang sudah dihapus tidak dapat diubah.",
        requestBody: requestBody(`${model}Input`),
        responses: {
          "200": jsonResponse(envelope(schemaRef(model))),
          "404": responseRef("NotFound"),
          ...(resource === "products" ? { "409": responseRef("Conflict") } : {}),
          ...bodyErrors,
          ...protectedErrors,
        },
      },
      delete: {
        tags: [tag],
        operationId: `delete${model}`,
        summary: `Soft delete ${resource === "products" ? "produk" : "pelanggan"}`,
        description: "Dikeluarkan dari daftar aktif. Relasi pada riwayat order tetap dapat dibaca.",
        responses: {
          "204": { description: "Dihapus, tanpa response body" },
          "404": responseRef("NotFound"),
          "422": responseRef("ValidationError"),
          ...protectedErrors,
        },
      },
    },
  };
}

const authResult = jsonResponse(envelope(schemaRef("AuthSession")));
authResult.headers = {
  "Set-Cookie": {
    description:
      "refresh_token JWT; HttpOnly; SameSite=Lax; Path=/api/auth; Max-Age=604800. Secure pada production. Browser menyimpan cookie secara otomatis.",
    schema: { type: "string" },
  },
};

/** Kept explicit and validated in tests so API documentation remains reviewable and offline-capable. */
export const openApiDocument: OpenAPIV3.Document = {
  openapi: "3.0.3",
  info: {
    title: "Aza Commerce — Order Management API",
    version: "0.1.0",
    description: [
      "REST API technical test Medior Fullstack Developer, Track A.",
      "1. Jalankan POST /auth/login memakai kredensial SEED_ADMIN_EMAIL dan SEED_ADMIN_PASSWORD dari environment lokal.",
      "2. Salin data.access_token, klik Authorize, dan isi bagian bearerAuth (token saja, tanpa awalan Bearer).",
      "3. Refresh cookie HttpOnly diatur otomatis oleh browser. POST /auth/refresh menggunakan cookie, bukan access token; setelah refresh, perbarui Bearer token di Authorize.",
      "4. Skenario wajib: order multi-item sukses, stok kurang (seluruh order rollback), input invalid (422), dan akses tanpa token (401). Contoh request tersedia pada POST /orders.",
      "Dokumentasi dapat dibuka tanpa login. Semua endpoint bisnis tetap memerlukan autentikasi. Nominal uang pada response berupa string decimal dua digit; zona waktu bisnis Asia/Jakarta.",
    ].join("\n\n"),
  },
  // Relative URL follows the same public origin/port that serves Swagger, including Docker.
  servers: [{ url: "/api", description: "Backend yang sedang dibuka" }],
  tags: [
    { name: "Authentication", description: "Login, refresh rotasi, profil, dan pencabutan sesi." },
    { name: "Products", description: "Katalog produk dan stok aktif." },
    { name: "Customers", description: "Data pelanggan aktif." },
    { name: "Orders", description: "Penjualan atomik, snapshot harga, dan riwayat." },
    { name: "Dashboard", description: "Ringkasan penjualan all-time." },
    { name: "Health", description: "Endpoint health yang memerlukan Bearer token." },
  ],
  security: [{ bearerAuth: [] }],
  paths: {
    "/auth/login": {
      post: {
        tags: ["Authentication"],
        operationId: "login",
        summary: "Login admin",
        security: [],
        description:
          "Kredensial berasal dari environment seeder; tidak ada password admin yang disimpan dalam spesifikasi. Access token berlaku 900 detik, refresh cookie 7 hari.",
        requestBody: requestBody("LoginInput"),
        responses: {
          "200": authResult,
          "401": responseRef("Unauthorized"),
          "403": responseRef("Forbidden"),
          "500": responseRef("InternalError"),
          ...bodyErrors,
        },
      },
    },
    "/auth/refresh": {
      post: {
        tags: ["Authentication"],
        operationId: "refreshSession",
        summary: "Rotasi refresh token dan dapatkan access token baru",
        security: [{ refreshCookie: [] }],
        description:
          "Login di browser yang sama terlebih dahulu. Cookie HttpOnly dikirim otomatis; jangan mencoba mengisi header Cookie secara manual di Swagger UI. Refresh token lama menjadi tidak valid setelah rotasi.",
        responses: {
          "200": authResult,
          "401": responseRef("Unauthorized"),
          "403": responseRef("Forbidden"),
          "500": responseRef("InternalError"),
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Authentication"],
        operationId: "logout",
        summary: "Cabut sesi aktif dan hapus refresh cookie",
        description:
          "Access token sesi ini langsung ditolak setelah logout. Sesi login lain tetap aktif.",
        responses: {
          "200": jsonResponse(
            envelope({ type: "object", nullable: true, example: null }),
            "Logout berhasil",
          ),
          "403": responseRef("Forbidden"),
          ...protectedErrors,
        },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Authentication"],
        operationId: "getProfile",
        summary: "Profil pengguna terautentikasi",
        responses: {
          "200": jsonResponse(envelope(schemaRef("User"))),
          "403": responseRef("Forbidden"),
          ...protectedErrors,
        },
      },
    },
    "/health": {
      get: {
        tags: ["Health"],
        operationId: "getHealth",
        summary: "Status service backend",
        responses: {
          "200": jsonResponse(
            envelope({
              type: "object",
              required: ["status"],
              properties: { status: { type: "string", enum: ["up"] } },
            }),
          ),
          ...protectedErrors,
        },
      },
    },
    ...masterPaths("products", "Products", "Product"),
    ...masterPaths("customers", "Customers", "Customer"),
    "/orders": {
      get: {
        tags: ["Orders"],
        operationId: "listOrders",
        summary: "Riwayat order dengan filter",
        description:
          "Terbaru dahulu. from/to adalah tanggal Indonesia inklusif; from harus <= to. Pelanggan/produk soft-deleted tetap dapat dibaca dalam riwayat.",
        parameters: ["Page", "PerPage", "FromDate", "ToDate", "CustomerFilter"].map(parameterRef),
        responses: {
          "200": jsonResponse(schemaRef("OrderListResponse")),
          "422": responseRef("ValidationError"),
          ...protectedErrors,
        },
      },
      post: {
        tags: ["Orders"],
        operationId: "createOrder",
        summary: "Buat transaksi penjualan atomik",
        description:
          "Customer dan produk harus aktif. Minimal 1/maksimal 100 produk berbeda, quantity integer positif. Harga, subtotal, total, pembuat, tanggal, dan nomor order dihitung server. Lock produk dan alokasi nomor INV-YYYYMMDD-XXXX berada dalam satu transaction. Satu item gagal membatalkan semua order/item/perubahan stok. Contoh UUID/ID mengacu pada seed; sesuaikan dengan data Anda.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: schemaRef("OrderInput"),
              examples: {
                success: {
                  summary: "Order multi-item berhasil",
                  value: {
                    customer_id: "00000000-0000-4000-8000-000000000001",
                    items: [
                      { product_id: 1, quantity: 2 },
                      { product_id: 3, quantity: 1 },
                    ],
                  },
                },
                insufficientStock: {
                  summary: "Stok tidak cukup — 422 dan rollback",
                  value: {
                    customer_id: "00000000-0000-4000-8000-000000000001",
                    items: [
                      { product_id: 1, quantity: 1 },
                      { product_id: 3, quantity: 2147483647 },
                    ],
                  },
                },
                invalidInput: {
                  summary: "Quantity tidak valid — 422",
                  value: {
                    customer_id: "00000000-0000-4000-8000-000000000001",
                    items: [{ product_id: 1, quantity: 0 }],
                  },
                },
                duplicateProduct: {
                  summary: "Produk duplikat — 422",
                  value: {
                    customer_id: "00000000-0000-4000-8000-000000000001",
                    items: [
                      { product_id: 1, quantity: 1 },
                      { product_id: 1, quantity: 1 },
                    ],
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": jsonResponse(
            envelope(schemaRef("OrderDetail")),
            "Order tersimpan dan stok berkurang",
          ),
          ...bodyErrors,
          "422": {
            description:
              "Input/master tidak valid atau stok tidak cukup. Tidak ada perubahan order/stok yang disimpan.",
            content: {
              "application/json": {
                schema: schemaRef("ErrorResponse"),
                examples: {
                  stock: {
                    value: {
                      success: false,
                      message: "Stok atau produk tidak tersedia",
                      errors: { "items.1.quantity": ["Stok Hydrococo tersisa 3, diminta 5"] },
                    },
                  },
                  validation: {
                    value: {
                      success: false,
                      message: "Validasi gagal",
                      errors: { "items.0.quantity": ["Number must be greater than 0"] },
                    },
                  },
                },
              },
            },
          },
          "409": responseRef("Conflict"),
          ...protectedErrors,
        },
      },
    },
    "/orders/{id}": {
      parameters: [parameterRef("NumericId")],
      get: {
        tags: ["Orders"],
        operationId: "getOrder",
        summary: "Detail order beserta item dan harga snapshot",
        description:
          "unit_price/subtotal/total historis tidak berubah ketika harga katalog diedit. Relasi master yang diarsipkan tetap disertakan.",
        responses: {
          "200": jsonResponse(envelope(schemaRef("OrderDetail"))),
          "404": responseRef("NotFound"),
          "422": responseRef("ValidationError"),
          ...protectedErrors,
        },
      },
    },
    "/dashboard/summary": {
      get: {
        tags: ["Dashboard"],
        operationId: "getDashboardSummary",
        summary: "Ringkasan dashboard",
        description:
          "Total transaksi dan penjualan all-time, maksimal 5 produk berdasarkan SUM(quantity), serta produk aktif dengan stock < 5. Produk diarsipkan tetap dapat masuk ranking historis.",
        responses: {
          "200": jsonResponse(envelope(schemaRef("DashboardSummary"))),
          ...protectedErrors,
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Isi access_token dari respons login/refresh, tanpa awalan Bearer.",
      },
      refreshCookie: {
        type: "apiKey",
        in: "cookie",
        name: "refresh_token",
        description:
          "Cookie HttpOnly yang dibuat otomatis oleh login; browser mengirimkannya saat refresh.",
      },
    },
    parameters: {
      Page: { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
      PerPage: {
        name: "per_page",
        in: "query",
        schema: { type: "integer", minimum: 1, maximum: 100, default: 10 },
      },
      Search: {
        name: "search",
        in: "query",
        schema: { type: "string", maxLength: 150 },
        description: "Pencarian nama; produk juga mendukung kode. Case-insensitive.",
      },
      ProductSort: {
        name: "sort",
        in: "query",
        schema: {
          type: "string",
          enum: ["product_name", "-product_name", "price", "-price", "stock", "-stock"],
          default: "product_name",
        },
      },
      NumericId: { name: "id", in: "path", required: true, schema: id },
      CustomerUuid: {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
      },
      FromDate: {
        name: "from",
        in: "query",
        schema: { type: "string", format: "date" },
        description: "Awal rentang inklusif (Asia/Jakarta).",
      },
      ToDate: {
        name: "to",
        in: "query",
        schema: { type: "string", format: "date" },
        description: "Akhir rentang inklusif (Asia/Jakarta).",
      },
      CustomerFilter: {
        name: "customer_id",
        in: "query",
        schema: { type: "string", format: "uuid" },
      },
    },
    responses: {
      Unauthorized: {
        ...jsonResponse(
          schemaRef("ErrorResponse"),
          "Token hilang/tidak valid/expired/revoked, atau kredensial salah",
        ),
      },
      Forbidden: jsonResponse(schemaRef("ErrorResponse"), "Origin browser tidak diizinkan"),
      NotFound: jsonResponse(
        schemaRef("ErrorResponse"),
        "Resource tidak ditemukan atau sudah diarsipkan pada endpoint master",
      ),
      Conflict: jsonResponse(
        schemaRef("ErrorResponse"),
        "Kode duplikat, batas 9999 nomor order per hari, atau konflik database setelah retry",
      ),
      ValidationError: jsonResponse(
        schemaRef("ErrorResponse"),
        "Validasi body/query/path gagal; errors berisi pesan per field",
      ),
      MalformedJson: jsonResponse(schemaRef("ErrorResponse"), "Body JSON malformed"),
      PayloadTooLarge: jsonResponse(schemaRef("ErrorResponse"), "Body melebihi batas 100 KB"),
      InternalError: jsonResponse(
        schemaRef("ErrorResponse"),
        "Kesalahan internal; detail tidak dibocorkan",
      ),
    },
    schemas: {
      Money: {
        type: "string",
        pattern: "^\\d{1,12}\\.\\d{2}$",
        example: "24000.00",
        description:
          "Decimal string dua digit, tanpa pembulatan floating-point pada perhitungan server.",
      },
      PriceInput: {
        description: "Harga > 0, maksimal 9999999999.99 dan dua desimal. String disarankan.",
        oneOf: [
          {
            type: "string",
            pattern: "^(?:0|[1-9]\\d{0,9})(?:\\.\\d{1,2})?$",
            not: { enum: ["0", "0.0", "0.00"] },
            example: "12000.50",
          },
          {
            type: "number",
            minimum: 0,
            exclusiveMinimum: true,
            maximum: 9999999999.99,
            multipleOf: 0.01,
            example: 12000.5,
          },
        ],
      },
      PaginationMeta: {
        type: "object",
        required: ["page", "per_page", "total", "total_pages"],
        properties: {
          page: { type: "integer", minimum: 1, example: 1 },
          per_page: { type: "integer", minimum: 1, maximum: 100, example: 10 },
          total: { type: "integer", minimum: 0, example: 30 },
          total_pages: { type: "integer", minimum: 0, example: 3 },
        },
      },
      ErrorResponse: {
        type: "object",
        required: ["success", "message"],
        properties: {
          success: { type: "boolean", enum: [false] },
          message: { type: "string", example: "Validasi gagal" },
          errors: {
            type: "object",
            additionalProperties: { type: "array", items: { type: "string" } },
            example: { "items.1.quantity": ["Stok produk tersisa 3, diminta 5"] },
            description: "Indeks items zero-based mengikuti request; error root memakai key _.",
          },
        },
      },
      User: {
        type: "object",
        required: ["id", "name", "email"],
        properties: {
          id,
          name: { type: "string", maxLength: 100 },
          email: { type: "string", format: "email", maxLength: 150 },
        },
      },
      LoginInput: {
        type: "object",
        additionalProperties: false,
        required: ["email", "password"],
        properties: {
          email: {
            type: "string",
            format: "email",
            maxLength: 150,
            description: "Gunakan SEED_ADMIN_EMAIL dari environment lokal.",
          },
          password: {
            type: "string",
            format: "password",
            minLength: 1,
            maxLength: 200,
            description: "Gunakan SEED_ADMIN_PASSWORD dari environment lokal.",
          },
        },
      },
      AuthSession: {
        type: "object",
        required: ["access_token", "expires_in", "user"],
        properties: {
          access_token: {
            type: "string",
            description: "JWT access token; gunakan Authorize → bearerAuth.",
          },
          expires_in: { type: "integer", example: 900 },
          user: schemaRef("User"),
        },
      },
      ProductInput: {
        type: "object",
        additionalProperties: false,
        required: ["product_code", "product_name", "stock", "price"],
        properties: productFields,
      },
      Product: {
        type: "object",
        required: [
          "id",
          "product_code",
          "product_name",
          "stock",
          "price",
          "created_at",
          "updated_at",
          "deleted_at",
        ],
        properties: {
          id,
          ...productFields,
          price: schemaRef("Money"),
          ...timestamps,
          deleted_at: nullableTimestamp,
        },
      },
      ProductListResponse: envelope({ type: "array", items: schemaRef("Product") }, true),
      CustomerInput: {
        type: "object",
        additionalProperties: false,
        required: ["customer_name", "customer_address", "gender", "birth_date"],
        properties: customerFields,
      },
      Customer: {
        type: "object",
        required: [
          "id",
          "customer_name",
          "customer_address",
          "gender",
          "birth_date",
          "phone",
          "created_at",
          "updated_at",
          "deleted_at",
        ],
        properties: {
          id: { type: "string", format: "uuid" },
          ...customerFields,
          ...timestamps,
          deleted_at: nullableTimestamp,
        },
      },
      CustomerListResponse: envelope({ type: "array", items: schemaRef("Customer") }, true),
      OrderInput: {
        type: "object",
        additionalProperties: false,
        required: ["customer_id", "items"],
        properties: {
          customer_id: { type: "string", format: "uuid" },
          items: {
            type: "array",
            minItems: 1,
            maxItems: 100,
            description: "product_id tidak boleh berulang. Harga/total tidak diterima dari client.",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["product_id", "quantity"],
              properties: {
                product_id: id,
                quantity: { type: "integer", minimum: 1, maximum: 2147483647 },
              },
            },
          },
        },
      },
      OrderItem: {
        type: "object",
        required: [
          "id",
          "order_id",
          "product_id",
          "quantity",
          "unit_price",
          "subtotal",
          "created_at",
          "updated_at",
          "product",
        ],
        properties: {
          id,
          order_id: id,
          product_id: id,
          quantity: { type: "integer", minimum: 1 },
          unit_price: schemaRef("Money"),
          subtotal: schemaRef("Money"),
          ...timestamps,
          product: schemaRef("Product"),
        },
      },
      OrderListEntry: {
        type: "object",
        required: [...Object.keys(orderFields), "customer", "_count"],
        properties: {
          ...orderFields,
          customer: schemaRef("Customer"),
          _count: {
            type: "object",
            required: ["items"],
            properties: { items: { type: "integer", minimum: 1 } },
          },
        },
      },
      OrderListResponse: envelope({ type: "array", items: schemaRef("OrderListEntry") }, true),
      OrderDetail: {
        type: "object",
        required: [...Object.keys(orderFields), "customer", "creator", "items"],
        properties: {
          ...orderFields,
          customer: schemaRef("Customer"),
          creator: schemaRef("User"),
          items: { type: "array", minItems: 1, items: schemaRef("OrderItem") },
        },
      },
      DashboardSummary: {
        type: "object",
        required: ["total_transactions", "total_sales", "top_products", "low_stock_products"],
        properties: {
          total_transactions: { type: "integer", minimum: 0 },
          total_sales: schemaRef("Money"),
          top_products: {
            type: "array",
            maxItems: 5,
            items: {
              type: "object",
              required: ["product", "quantity_sold"],
              properties: {
                product: schemaRef("Product"),
                quantity_sold: { type: "integer", minimum: 1 },
              },
            },
          },
          low_stock_products: { type: "array", items: schemaRef("Product") },
        },
      },
    },
  },
};
