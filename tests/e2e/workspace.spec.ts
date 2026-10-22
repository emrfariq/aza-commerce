import { expect, test, type Download, type Page } from "@playwright/test";

/**
 * Menjalankan login melalui browser menggunakan kredensial seed dan memastikan dashboard
 * pengguna sudah tampil.
 */
async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(process.env.SEED_ADMIN_EMAIL!);
  await page.getByLabel("Password", { exact: true }).fill(process.env.SEED_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Masuk ke workspace" }).click();
  const firstName = (process.env.SEED_ADMIN_NAME ?? "Admin").trim().split(" ")[0];
  await expect(
    page.getByRole("heading", { name: `Halo, ${firstName}.`, exact: true }),
  ).toBeVisible();
}

/**
 * Membaca seluruh aliran unduhan Playwright menjadi Buffer untuk memeriksa isi berkas yang
 * diunduh.
 */
async function downloadBuffer(download: Download): Promise<Buffer> {
  const stream = await download.createReadStream();
  if (!stream) throw new Error("Download stream unavailable");
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

/**
 * Menguji alur penjualan lengkap lewat UI: CRUD, error item, pembuatan order, konsistensi harga
 * historis, dan logout.
 */
test("complete sales workflow: CRUD, item errors, snapshot history and logout", async ({
  page,
}, testInfo) => {
  const suffix = String(Date.now());
  const product = `E2E Teh ${suffix}`;
  const customer = `E2E Budi ${suffix}`;
  await login(page);
  await page.screenshot({
    path: testInfo.outputPath("desktop-dashboard.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("link", { name: "Produk", exact: true }).click();
  await page.getByRole("button", { name: "Tambah produk", exact: true }).first().click();
  await page.getByLabel("Kode produk", { exact: true }).fill(`E${suffix}`);
  await page.getByLabel("Nama produk", { exact: true }).fill(product);
  await page.getByLabel("Harga satuan (Rp)", { exact: true }).fill("12000.50");
  await page.getByLabel("Stok", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByLabel("Cari produk", { exact: true }).fill(suffix);
  await expect(page.getByRole("cell", { name: product, exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Pelanggan", exact: true }).click();
  await page.getByRole("button", { name: "Tambah pelanggan", exact: true }).first().click();
  await page.getByLabel("Nama pelanggan", { exact: true }).fill(customer);
  await page.getByLabel("Alamat", { exact: true }).fill("Jl. E2E, Jakarta");
  await page.getByLabel("Tanggal lahir", { exact: true }).fill("1995-02-10");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();

  await page.goto("/orders/new");
  await page.getByRole("button", { name: "Pilih pelanggan", exact: true }).click();
  await page.getByLabel("Cari Pilih pelanggan", { exact: true }).fill(suffix);
  await page.getByRole("button", { name: new RegExp(customer) }).click();
  await page.getByRole("button", { name: "Pilih produk item 1", exact: true }).click();
  await page.getByLabel("Cari Pilih produk item 1", { exact: true }).fill(suffix);
  await page.getByRole("button", { name: new RegExp(product) }).click();
  await page.getByLabel("Jumlah", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Simpan order", exact: true }).click();
  await expect(page.getByText(`Stok ${product} tersisa 5, diminta 10`)).toBeVisible();
  await page.getByLabel("Jumlah", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Simpan order", exact: true }).click();
  await expect(page).toHaveURL(/\/orders\/\d+/);
  await expect(page.getByText("Transaksi berhasil dicatat.", { exact: false })).toBeVisible();
  await expect(page.getByText("Rp 24.001", { exact: true }).last()).toBeVisible();
  const orderUrl = page.url();
  await page.reload();
  await expect(page.getByRole("heading", { name: /INV-/ })).toBeVisible();

  await page.getByRole("link", { name: "Produk", exact: true }).click();
  await page.getByLabel("Cari produk", { exact: true }).fill(suffix);
  await page.getByRole("button", { name: `Edit ${product}`, exact: true }).click();
  await page.getByLabel("Harga satuan (Rp)", { exact: true }).fill("99000");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: `Hapus ${product}`, exact: true }).click();
  await page.getByRole("button", { name: "Ya, hapus produk", exact: true }).click();
  await expect(page.getByText("Produk berhasil dihapus.")).toBeVisible();
  await page.goto(orderUrl);
  await expect(page.getByText("Rp 24.001", { exact: true }).last()).toBeVisible();
  await expect(page.getByText(/Diarsipkan/)).toBeVisible();
  await page.getByRole("button", { name: "Keluar", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/orders");
  await expect(page).toHaveURL(/\/login$/);
});

/** Menguji navigasi seluler, tampilan loading dan error, serta pengalihan ketika sesi berakhir. */
test("mobile navigation, data states and session expiry", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/products");
  await expect(page).toHaveURL(/\/login$/);
  await login(page);
  await page.getByRole("button", { name: "Buka menu" }).click();
  await page.getByRole("link", { name: "Produk", exact: true }).click();
  await page.getByLabel("Cari produk", { exact: true }).fill("nothing-matches-this-search");
  await expect(page.getByRole("heading", { name: "Tidak ada hasil pencarian" })).toBeVisible();
  expect(
    await page.evaluate(
      /*
       * Memeriksa di browser bahwa lebar konten tidak melampaui viewport seluler.
       */
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("mobile-products.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.route(
    "**/api/products?**",
    /*
     * Mensimulasikan respons server 500 yang tertunda agar keadaan loading dan error bisa
     * diamati.
     */
    async (route) => {
      await new Promise(
        /*
         * Menunda respons tiruan selama 400 milidetik untuk pengujian indikator loading.
         */
        (resolve) => setTimeout(resolve, 400),
      );
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ success: false, message: "Server sedang mengalami kendala" }),
      });
    },
  );
  await page.getByLabel("Cari produk", { exact: true }).fill("error-state-test");
  await expect(page.getByRole("status")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Data belum dapat dimuat" })).toBeVisible();
  await page.unroute("**/api/products?**");
  await page.getByRole("button", { name: "Coba lagi", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tidak ada hasil pencarian" })).toBeVisible();
  await page.context().clearCookies();
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
});

/**
 * Menguji perubahan periode grafik dan unduhan CSV/XLSX sesuai filter, termasuk pemulihan access
 * token lewat refresh.
 */
test("daily sales periods and filtered CSV/Excel downloads with token refresh", async ({
  page,
}) => {
  await login(page);
  const chart = page.getByRole("region", { name: "Grafik penjualan harian" });
  await expect(chart.locator(".recharts-area-curve")).toBeVisible();
  const [daily] = await Promise.all([
    page.waitForResponse(
      /*
       * Mengenali respons grafik untuk periode tujuh hari agar pengujian menunggu request
       * yang tepat.
       */
      (response) => response.url().includes("/api/dashboard/daily-sales?days=7"),
    ),
    chart.getByRole("button", { name: "7 hari", exact: true }).click(),
  ]);
  expect((await daily.json()).data.series).toHaveLength(7);
  await expect(chart.getByRole("button", { name: "7 hari", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await chart.getByText("Lihat data harian", { exact: true }).click();
  await expect(chart.locator("tbody tr")).toHaveCount(7);

  await page.goto("/orders");
  await page.getByLabel("Dari tanggal", { exact: true }).fill("2000-01-01");
  await page.getByLabel("Sampai tanggal", { exact: true }).fill("2099-12-31");
  await page.getByRole("button", { name: "Semua pelanggan", exact: true }).click();
  await page.getByLabel("Cari Semua pelanggan", { exact: true }).fill("Budi Santoso");
  const [filtered] = await Promise.all([
    page.waitForResponse(
      /*
       * Mengenali request daftar order yang sudah menyertakan filter pelanggan.
       */
      (response) =>
        new URL(response.url()).pathname === "/api/orders" &&
        new URL(response.url()).searchParams.has("customer_id"),
    ),
    page.getByRole("button", { name: /^Budi Santoso/ }).click(),
  ]);
  const expectedRows = (await filtered.json()).meta.total as number;

  // Respons 401 harus memicu refresh sebelum unduhan biner diulang, sama seperti request JSON.
  await page.route(
    "**/api/orders/export?**",
    /*
     * Mengembalikan respons 401 tiruan untuk memicu mekanisme refresh token saat unduhan.
     */
    (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ success: false, message: "Token expired" }),
      }),
    { times: 1 },
  );
  const [csv, refreshed] = await Promise.all([
    page.waitForEvent("download"),
    page.waitForResponse(
      /*
       * Mengenali respons endpoint refresh sebagai bukti pembaruan sesi terjadi.
       */
      (response) => new URL(response.url()).pathname === "/api/auth/refresh",
    ),
    page.getByRole("button", { name: "Export CSV", exact: true }).click(),
  ]);
  expect(refreshed.status()).toBe(200);
  expect(csv.suggestedFilename()).toMatch(/^riwayat-order-\d{8}\.csv$/);
  const text = (await downloadBuffer(csv)).toString("utf8");
  expect(text).toContain('"No. Order","Tanggal Order (WIB)"');
  const records = text.trimEnd().split("\r\n").slice(1);
  expect(records).toHaveLength(expectedRows);
  expect(
    records.every(
      /*
       * Memastikan setiap baris CSV sesuai dengan pelanggan yang dipilih pada filter.
       */
      (record) => record.includes("Budi Santoso"),
    ),
  ).toBe(true);
  expect(text).not.toContain("Bayu Nugroho");

  const [excel] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export Excel", exact: true }).click(),
  ]);
  expect(excel.suggestedFilename()).toMatch(/^riwayat-order-\d{8}\.xlsx$/);
  expect((await downloadBuffer(excel)).subarray(0, 2).toString()).toBe("PK");
  await page.getByLabel("Dari tanggal", { exact: true }).fill("2099-12-31");
  await page.getByLabel("Sampai tanggal", { exact: true }).fill("2000-01-01");
  await expect(
    page.getByText("Tanggal awal harus sebelum tanggal akhir.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Export CSV", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Export Excel", exact: true })).toBeDisabled();
});
