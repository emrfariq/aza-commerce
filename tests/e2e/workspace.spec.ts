import { expect, test, type Page } from "@playwright/test";

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

test("mobile navigation, data states and session expiry", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/products");
  await expect(page).toHaveURL(/\/login$/);
  await login(page);
  await page.getByRole("button", { name: "Buka menu" }).click();
  await page.getByRole("link", { name: "Produk", exact: true }).click();
  await page.getByLabel("Cari produk", { exact: true }).fill("nothing-matches-this-search");
  await expect(page.getByRole("heading", { name: "Tidak ada hasil pencarian" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: testInfo.outputPath("mobile-products.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.route("**/api/products?**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ success: false, message: "Server sedang mengalami kendala" }),
    });
  });
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
