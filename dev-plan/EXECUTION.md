# Checklist eksekusi

Sumber requirement: [PRD](PRD.md) dan PDF technical test.

- [x] Inspeksi fondasi existing dan simpan PRD.
- [x] Backend: environment, auth, CRUD, order atomik, riwayat, dashboard.
- [x] Seed: 1 admin, 20 produk, 15 customer, 30 order / 30 hari.
- [x] Frontend Next.js: login, CRUD, order, riwayat/detail, dashboard, responsive states.
- [x] Integration tests PostgreSQL nyata termasuk concurrency dan rollback.
- [x] Verifikasi migration kosong, seed, type-check, test, production build.
- [x] README, API documentation, environment examples.

## Hasil verifikasi lokal — 21 Oktober 2026

| Pemeriksaan                   | Hasil                                                   |
| ----------------------------- | ------------------------------------------------------- |
| Node / pnpm                   | 24.21.0 / 10.33.0                                       |
| Migration existing            | 2 migration berhasil pada DB test dan DB E2E kosong     |
| Seed utama                    | 1 user,20 produk,15 pelanggan,30 order,60 item          |
| Rentang seed                  | 22 September–21 Oktober 2026,30 tanggal berbeda         |
| Konsistensi total             | 0 order dengan total berbeda dari SUM(subtotal)         |
| Stok negatif                  | 0 produk                                                |
| pnpm lint                     | Lulus type-check root/E2E/backend/frontend              |
| pnpm test                     | 16 lulus:4 fondasi+12 integration test                  |
| pnpm build                    | Backend tsc dan frontend Next.js production berhasil    |
| pnpm test:e2e                 | 2 test Chromium lulus desktop/mobile                    |
| docker compose config --quiet | Valid                                                   |
| git diff --check              | Lulus (hanya pemberitahuan normalisasi LF/CRLF Windows) |

### Cakupan test bisnis

Sukses order multi-item dengan Decimal, rollback jika item kedua stok kurang, input
invalid/duplikat/price tampering, token hilang/expired, request stok terakhir paralel,
alokasi nomor paralel antarproduk, snapshot setelah perubahan harga, riwayat soft delete,
refresh rotation/logout revocation, CRUD/search/sort/pagination, filter tanggal, dashboard.

E2E menjalankan dua service sungguhan terhadap DB `azatech_order_db_e2e_test` terpisah.
Cakupan: login, tambah produk/customer, pilih lewat search, server error quantity di baris,
simpan order, session restore saat reload, ubah harga/delete produk, harga historis tetap,
logout/protected redirect, mobile drawer, empty/loading/error/retry, session expiry.
Screenshot desktop1440px dan mobile390px sudah ditinjau; tidak ada horizontal overflow halaman.
Artefak lokal tersedia di test-results/ (Git ignored).

## Perapian kode dan kelengkapan README

- Format TypeScript, JSX, CSS, JSON, YAML, dan Markdown diseragamkan dengan Prettier.
  Tersedia `pnpm format` dan `pnpm format:check`; CI juga memeriksa format.
- Komentar dokumentasi menjelaskan atomicity, urutan lock, pemetaan indeks error item,
  snapshot harga, alokasi nomor order, retry konflik, refresh rotation, dan session lifecycle.
- README memuat tabel stack/alasan, setup enam perintah, petunjuk login dari environment
  seeder, alur order/stok, cara test, asumsi, keterbatasan, serta prioritas perbaikan.
- Verifikasi setelah perapian: format check, type-check, 16 automated test backend,
  production build backend/frontend, dan pemeriksaan whitespace berhasil.

## Pemisahan seed autentikasi

- Logika admin dipindahkan ke `apps/backend/prisma/seeds/admin.ts` dan hanya membaca
  `SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` dari environment lokal.
- `pnpm db:seed:auth` tersedia untuk seed admin saja. Seed penuh tetap memanggil modul
  yang sama sebelum membuat data bisnis.
- Kredensial asli hanya berada di file `.env` yang Git ignored; README, Postman,
  Compose, dan E2E tidak lagi menyimpan kredensial admin lokal secara hardcoded.
- Setup baru menghasilkan password acak; konfigurasi akun lokal existing dipertahankan.
- Kode seeder generik tetap disertakan di repository agar reviewer dapat menjalankan
  migration dan seed dari database kosong sesuai PDF.
- Verifikasi perubahan ini: `pnpm env:setup`, `pnpm db:seed:auth`, `pnpm lint`, dan
  `docker compose config --quiet` berhasil. Git mengabaikan root/backend `.env`;
  file kredensial tersebut tidak terdaftar sebagai tracked files. Referensi kredensial
  admin lokal sebelumnya telah dihapus dari source dan dokumentasi publik.

## Bonus

### Penyesuaian port development

Frontend lokal dipindahkan ke `http://localhost:3200` karena port 3000 digunakan Grafana.
Script dev/start, origin CORS backend, environment lokal/contoh, setup script, dan host
port Compose diselaraskan. Backend tetap port 4000. Port internal container frontend
tetap 3000 dan port frontend E2E tetap 3100.

- [x] Implementasi E2E Playwright dan test desktop/mobile terverifikasi lokal.
- [x] Workflow GitHub Actions lint/test/build/E2E disediakan.
- [x] Dockerfile dua service dan Compose full stack disediakan; config valid.
- [x] Build image dan jalankan ketiga container full stack hingga healthy.
- [x] Smoke test API dan browser pada deployment Docker, termasuk session restore/logout.
- [ ] Grafik penjualan harian (opsional, tidak dikerjakan).
- [ ] Export CSV/Excel (opsional, tidak dikerjakan).

Percobaan awal build tertahan DNS `registry-1.docker.io`. Pada percobaan berikutnya DNS
sudah pulih dan base image `node:24-bookworm-slim` berhasil diunduh. Build pertama melewati
batas waktu karena mengunduh dependency seluruh monorepo untuk kedua image.

Perbaikan Docker yang disiapkan:

- Install dependency dibatasi per service melalui filter pnpm.
- Cache dependency BuildKit disimpan terpisah dari layer source agar dapat dipakai ulang.
- Image hanya menyalin source service terkait; file environment lokal dikecualikan.
- Healthcheck frontend ditambahkan agar Compose menunggu halaman login siap.

Percobaan build berikutnya mengalami `rpc error ... EOF`, lalu Docker Desktop berhenti.
Pemeriksaan host menunjukkan drive C tersisa sekitar 36 MB, sedangkan D masih memiliki
sekitar 156 GB. Kandidat memindahkan disk image melalui pengaturan Docker Desktop ke drive D;
Docker Engine kemudian kembali berjalan dengan volume database existing tetap tersedia.

### Hasil verifikasi Docker setelah pemindahan

- Image `azatech-order-backend:latest` dan `azatech-order-frontend:latest` berhasil dibangun.
- Build frontend sempat mengalami SIGSEGV saat memuat SWC native. Hash binary pada layer
  tersimpan berbeda dari binary paket npm yang diunduh ulang, sedangkan binary baru dapat
  dimuat pada container yang sama. Dependency frontend kemudian dibangun ulang menggunakan
  cache service terpisah dan pemeriksaan integritas; build Turbopack standar berhasil.
- `docker compose up -d --no-build --wait --wait-timeout 180` selesai dengan PostgreSQL,
  backend, dan frontend berstatus healthy pada port host 5434, 4000, dan 3200.
- Migration dijalankan otomatis (tidak ada migration tertunda), kemudian seed selesai tanpa
  mereset data existing: 1 user, 20 produk, 15 customer, dan 31 order pada saat pemeriksaan.
- Smoke test API: login, me, products, customers, orders, dashboard, logout, dan penolakan
  access token sesi yang telah dicabut berhasil sesuai status yang diharapkan.
- Smoke test Chromium: login di port 3200, dashboard, reload/session restore menggunakan
  refresh cookie, navigasi produk/customer/riwayat, dan logout berhasil.
- Tidak ada order dengan total berbeda dari SUM(subtotal), serta tidak ada stok negatif.
- Kedua container aplikasi berjalan sebagai UID 1000. File `.env` lokal tidak ada di image;
  environment hanya diberikan oleh Compose pada runtime.
- Artefak smoke test dan screenshot Docker tersimpan di `test-results/` yang Git ignored.

CI GitHub belum dijalankan di remote; hasil di atas merupakan verifikasi Docker lokal.

## Swagger UI dan OpenAPI

- [x] Swagger tersedia pada `http://localhost:4000/api/docs/`; root port 4000 redirect ke UI.
- [x] Dokumen OpenAPI 3.0.3 mentah tersedia pada `/api/openapi.json`, mencakup 19 operasi API.
- [x] Schema request/response, pagination, query/path parameters, Bearer authentication,
  refresh cookie, status/error, dan contoh order sukses/gagal didokumentasikan.
- [x] Origin Swagger diizinkan secara eksplisit melalui `API_PUBLIC_URL`; origin frontend
  tetap memakai `FRONTEND_URL`. Origin browser tidak terdaftar tetap ditolak.
- [x] Tiga test dokumentasi dan satu integration test origin ditambahkan. Total test saat
  ini 20 lulus: 4 fondasi, 13 integration, dan 3 Swagger/OpenAPI.
- [x] Backend Docker berhasil dibangun ulang dan dijalankan kembali dalam status healthy.
- [x] Verifikasi Chromium di Swagger: login/Authorize, GET products terautentikasi,
  order stok kurang (422, stok item lain tetap), refresh cookie, logout, dan pencabutan token.

Dokumentasi bersifat publik agar dapat dibuka sebelum login; middleware auth tetap
melindungi seluruh endpoint bisnis. Tidak ada kredensial seeder atau token aktif yang
disimpan dalam spesifikasi. Artefak browser berada di `test-results/` yang Git ignored.

## Langkah pengumpulan oleh kandidat

- [ ] Tinjau kode dan siapkan penjelasan auth, locking, snapshot, query, cache, dan test.
- [x] Commit lokal bertahap sesuai unit pekerjaan, dengan staging path eksplisit dan tanpa file kredensial.
- [ ] Push ke repository GitHub public dan periksa hasil Actions.
- [ ] Isi URL clone/nama kandidat pada materi pengumpulan.
- [ ] Kirim link ke recruitment@azatech.id, subject
      `[Medior Fullstack Developer] Technical Result_[Nama Anda]`.

### Urutan commit lokal

Panduan staging dengan path eksplisit dan pemeriksaan sebelum setiap commit tersedia di
[COMMIT_GUIDE.md](COMMIT_GUIDE.md). Pembagian berikut diterapkan per unit pekerjaan;
dokumen hasil eksekusi ini disertakan pada tahap dokumentasi terakhir.

1. `feat/document requirements and phased delivery`
2. `feat/configure workspace dependencies and code formatting`
3. `feat/implement authenticated order management and seed data`
4. `feat/build responsive admin workspace`
5. `feat/add transaction authentication and browser tests`
6. `feat/add container setup and automated quality checks`
7. `feat/document setup API contracts and verification results`

Pesan commit baru mengikuti format `feat/judul commit` sesuai permintaan kandidat.
Setiap tahap melalui review status, staged diff, whitespace check, dan riwayat sebelum commit.
Tidak digunakan staging seluruh repository. File `.env`, `.serena/`, `opencode.json`,
dan PDF soal tidak disertakan pada commit implementasi.

Pemeriksaan penutup berhasil: `pnpm format:check`, `pnpm lint`, `pnpm test` (16 lulus),
serta `pnpm build` backend/frontend. Riwayat aktual dapat diperiksa melalui
`git log --oneline -10`. Push dan pengumpulan repository tetap merupakan langkah terpisah.
