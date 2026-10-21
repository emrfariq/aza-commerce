# Aza Commerce — Order Management

Technical test Medior Fullstack Developer untuk Azatech. Workspace admin berbahasa
Indonesia untuk produk, pelanggan, transaksi multi-item, riwayat, dan dashboard.

## Tech stack yang dipilih dan alasannya

Project menggunakan **Track A (TypeScript)** dengan backend dan frontend sebagai dua service terpisah.

| Kebutuhan              | Pilihan                            | Alasan                                                                                                       |
| ---------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Runtime dan bahasa     | Node.js 24+, TypeScript strict     | Sesuai requirement; type-check membantu menangkap kontrak dan nilai nullable sebelum runtime.                |
| REST API               | Express 5                          | Framework ringan, routing eksplisit, dan native async error handling yang terpusat.                          |
| Database               | PostgreSQL 16                      | Mendukung constraint, transaksi, row locking, dan advisory lock untuk integritas stok/nomor order.           |
| ORM dan migration      | Prisma 6.19.3                      | Query type-safe, migration terkontrol, Decimal untuk uang, serta melanjutkan fondasi existing.               |
| Autentikasi            | JWT access + refresh, bcryptjs     | Access token berumur pendek, refresh bisa dirotasi/dicabut, dan password di-hash.                            |
| Validasi               | Zod                                | Satu boundary validasi untuk body/query/parameter dan field errors yang mudah dipetakan ke UI.               |
| Frontend               | React 19 + Next.js 16 App Router   | Routing halaman dan komposisi layout; seluruh logika bisnis tetap di backend Express.                        |
| Server state           | TanStack Query                     | Cache, status request, invalidation setelah mutasi, dan refetch tanpa state fetch manual berulang.           |
| UI                     | Tailwind CSS 4 + CSS komponen      | Responsive layout dan styling konsisten tanpa ketergantungan UI library yang besar.                          |
| Monorepo               | pnpm 10 workspaces                 | Dependency dan perintah terpusat, tetapi kedua service tetap dapat dijalankan sendiri.                       |
| Automated test         | Vitest + Supertest, Playwright     | Integration test menggunakan PostgreSQL nyata; browser test memverifikasi alur pengguna.                     |
| Format kode            | Prettier                           | Format TypeScript, JSX, CSS, JSON, dan dokumentasi yang konsisten serta dapat diperiksa di CI.               |
| Dokumentasi interaktif | OpenAPI 3.0.3 + Swagger UI Express | Kontrak request/response, autentikasi, contoh skenario bisnis, dan pengujian endpoint langsung dari browser. |

Next.js API Routes dan Server Actions tidak dipakai sebagai backend utama. Browser memanggil
REST API Express; hanya backend yang mengakses database.

## Setup lokal — enam perintah

Prasyarat: **Node.js >=24**, **pnpm 10.33.0**, Docker Engine/Desktop dengan Compose v2,
serta port 5434 (database), 4000 (backend), dan 3200 (frontend) tersedia.
Ganti URL repository dengan URL GitHub hasil pengumpulan Anda.

```sh
git clone <URL_REPOSITORY_ANDA> order_management
cd order_management
pnpm install --frozen-lockfile
pnpm env:setup
pnpm db:bootstrap
pnpm dev
```

`env:setup` membuat environment lokal, random JWT secrets, dan password admin acak;
nilai existing dipertahankan. Kredensial admin hanya ditulis ke file `.env` yang diabaikan Git.
`db:bootstrap` menunggu PostgreSQL sehat, generate Prisma Client, menerapkan migration,
dan menjalankan seed. Tidak melakukan reset database. Initial seed menyediakan 1 admin,
20 produk, 15 pelanggan, dan 30 order tersebar dalam 30 hari terakhir, termasuk produk stok rendah.
Rerun seed menggunakan upsert tanpa menimpa master existing dan menambahkan order hanya
sampai target 30 untuk admin demo; tidak memulihkan data yang sudah diedit/dihapus.

| Akses            | Nilai                                              |
| ---------------- | -------------------------------------------------- |
| Frontend         | http://localhost:3200                              |
| Backend API      | http://localhost:4000/api                          |
| Swagger UI       | http://localhost:4000/api/docs/                    |
| Email admin      | Nilai `SEED_ADMIN_EMAIL` di `apps/backend/.env`    |
| Password admin   | Nilai `SEED_ADMIN_PASSWORD` di `apps/backend/.env` |
| PostgreSQL lokal | localhost:5434 / azatech_order_db                  |

### Login menggunakan akun seeder

Setelah setup dan seed selesai:

1. Buka `apps/backend/.env`, lalu lihat nilai `SEED_ADMIN_EMAIL` dan `SEED_ADMIN_PASSWORD`.
2. Buka **http://localhost:3200/login** dan masukkan kedua nilai tersebut.
3. Setelah login, dashboard menampilkan ringkasan dari data demo yang telah di-seed.

Pada setup baru, password dibuat acak. Petunjuk akun tersedia di README ini, sedangkan nilai
kredensial tetap lokal sesuai pemisahan seed autentikasi. Rerun setup mempertahankan konfigurasi
dan akun yang sudah ada.

### Seeder autentikasi terpisah

- `apps/backend/prisma/seeds/admin.ts`: logika seeder generik tanpa kredensial hardcoded.
- `apps/backend/prisma/seed-auth.ts`: entry point untuk hanya membuat admin.
- `apps/backend/.env`: `SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` lokal.
  File ini **tidak masuk Git**. `.env.example` hanya mencantumkan nama variabel tanpa kredensial.
- Root `.env`: konfigurasi privat untuk Docker Compose; setup mengisi nilai yang belum ada
  dari environment backend. Jika mengubah kredensial Docker secara manual, selaraskan file ini.

Untuk membuat admin saja tanpa menambah produk, pelanggan, atau order:

```sh
pnpm db:seed:auth
```

`pnpm db:seed` tetap menjalankan seed admin dan seluruh data bisnis sesuai syarat technical test.
Password seed wajib minimal 8 karakter, maksimal 72 byte sesuai batas bcrypt. Nilai email dan
password di environment digunakan saat **user baru** dibuat; rerun tidak mengganti password
user existing. Mengganti email membuat user berbeda. Akun lokal yang sebelumnya sudah ada
tetap dipertahankan.

### Service terpisah dan production build

```sh
pnpm dev:backend
pnpm dev:frontend
```

Jalankan pada terminal berbeda. Backend membaca `apps/backend/.env`; frontend membaca
`apps/frontend/.env.local`. Contoh konfigurasi tersedia di `.env.example` masing-masing.
Jika mengganti port/origin, sesuaikan `PORT`, `FRONTEND_URL`, `API_PUBLIC_URL`, dan `NEXT_PUBLIC_API_URL`.
`NEXT_PUBLIC_API_URL` dibundel saat build, sehingga perubahan memerlukan rebuild frontend.

```sh
pnpm build
pnpm --filter @app/backend start
pnpm --filter @app/frontend start
```

`NODE_ENV=production` mengaktifkan Secure refresh cookie; gunakan HTTPS untuk deployment
dan domain frontend/backend same-site. Environment backend wajib memiliki dua JWT secrets
independen minimal 32 karakter. Backend tetap satu-satunya service yang mengakses database.

## Fitur

- Login, refresh rotasi, profil, logout dan protected routes.
- Produk: CRUD, pagination, pencarian nama/kode, sort nama/harga/stok, soft delete.
- Pelanggan: CRUD, pagination, pencarian nama, tanggal/gender/nomor telepon, soft delete.
- Order: pilih customer/produk dengan pencarian berpaginasi, item dinamis, estimasi uang
  decimal-safe, error per item, server-side price snapshot dan stock validation.
- Riwayat: filter tanggal dan pelanggan, pagination, detail termasuk master diarsipkan.
- Dashboard: total transaksi, total penjualan, lima produk terlaris, stock < 5.
- Responsive desktop/mobile, loading/empty/error/retry, dialog konfirmasi, format id-ID.

### Struktur dan tanggung jawab kode

```text
apps/backend/
  src/app.ts             # Komposisi middleware dan router; terpisah dari HTTP listener.
  src/modules/           # Auth, products, customers, orders, dan dashboard.
  src/middlewares/       # Verifikasi sesi dan centralized error handling.
  src/utils/             # Response envelope, DTO serialization, dan validasi umum.
  prisma/                # Schema, migration, seed data, dan modul seed admin.
  tests/                 # Test fondasi dan integration test PostgreSQL.
apps/frontend/
  src/app/               # Halaman App Router dan protected layout.
  src/components/        # Tabel/form master, picker berpaginasi, dialog, dan shell.
  src/lib/               # API client, tipe response, format tanggal dan Rupiah.
  src/providers/         # Session lifecycle dan QueryClient.
tests/e2e/               # Alur browser desktop/mobile.
docs/api/                # Kontrak API dan Postman collection.
dev-plan/                # PRD dan catatan hasil eksekusi.
```

## Alur order dan integritas stok

1. Zod strict memvalidasi request; minimal 1/maksimal 100 produk berbeda, quantity positif.
   Harga, total, nomor, tanggal, dan pembuat dari client ditolak.
2. Mulai satu **interactive database transaction**.
3. Lock customer aktif `FOR SHARE`, sehingga soft delete tidak menyusup di tengah transaksi.
4. Lock semua produk `FOR UPDATE` dalam urutan ID untuk mengurangi potensi deadlock.
5. Baca harga/stok setelah lock; validasi semua item. Error memakai indeks request asli.
6. Gunakan **Prisma.Decimal** untuk snapshot unit_price, subtotal, dan total; validasi batas nominal.
7. Alokasikan `INV-YYYYMMDD-XXXX` di zona Asia/Jakarta. Transaction-scoped PostgreSQL
   advisory lock per tanggal menyerialisasi alokasi, dan unique constraint tetap melindungi nomor.
8. Simpan order/items, kurangi stok, lalu commit. Respons 201 hanya setelah commit berhasil.
9. Kegagalan apa pun me-rollback semua perubahan. Konflik transient/deadlock dicoba ulang
   maksimal 3 percobaan; bisnis tidak valid tidak di-retry.

Dua request yang memperebutkan stok terakhir tidak dapat sama-sama membelinya.
Tidak ada `check-then-update` stok di luar transaction. UI total hanya preview; hasil server
otoritatif. Tidak ada HTTP call di dalam transaksi. Order final, tidak ada edit/cancel/refund.

### Schema dan keputusan tambahan

- Lima tabel wajib mengikuti PDF. `@map`/`@@map` menjaga snake_case database dan camelCase TS.
- `refresh_tokens` tambahan menyimpan SHA256 token, expiry, revoked_at, user_id.
  JWT access memuat session ID; middleware memeriksa sesi sehingga logout segera efektif.
- Harga `decimal(12,2)`; subtotal/total `decimal(14,2)`. API mengirim string dua desimal.
- CHECK constraints: harga/unit price positif, stok nonnegatif, quantity positif, total/subtotal
  nonnegatif. FK menjaga referensi. Unique kode produk mencakup baris soft-deleted.
- Index order_date, (customer_id,order_date), created_by, order_items.order_id/product_id,
  refresh_tokens.user_id mendukung filter/agregasi.
- Tidak ada cascade delete dari produk/customer; soft delete menjaga relasi historis.
  Harga historis snapshot; nama produk/customer mengikuti master terkini.
- Timestamp disimpan timezone-aware; tanggal filter Indonesia inklusif diterjemahkan ke
  `[awal hari, awal hari sesudah tanggal akhir)`. Birth date adalah calendar date.
- IDs bigint dipublikasikan sebagai safe JS number; customer memakai UUID.

## Cara menjalankan test dan quality checks

```sh
pnpm format:check
pnpm lint
pnpm test
pnpm build
```

Jalankan dari root repository setelah setup. `format:check` hanya memeriksa konsistensi format;
gunakan `pnpm format` untuk merapikan kode saat pengembangan.

`lint` adalah **TypeScript type-check**, termasuk konfigurasi/test E2E; bukan klaim ESLint.
`pnpm test` menjalankan 20 test: 4 test fondasi, 13 integration test, dan 3 test Swagger/OpenAPI.
Skenario mencakup sukses order, rollback
item kedua, input/tampering/duplikat, tanpa/expired token, overselling paralel, nomor unik
paralel, price snapshot, soft delete, refresh/logout, CRUD, filter, dashboard, validasi spesifikasi,
akses dokumentasi, serta whitelist origin browser untuk Swagger.

Runner otomatis membuat `azatech_order_db_test` dan menerapkan migration dari database
kosong. Integration suite melakukan TRUNCATE **hanya pada DB test**, tanpa mock transaksi.
User database harus memiliki hak CREATEDB. Untuk environment terkelola, sediakan database
terpisah dan `TEST_DATABASE_URL`; nama database wajib berakhiran `_test`.

### Browser E2E (bonus)

Setelah build, dengan port 4000 dan 3100 kosong:

```sh
pnpm exec playwright install chromium --only-shell
pnpm test:e2e
```

Runner membuat DB terpisah `azatech_order_db_e2e_test`, migrate/seed, lalu Playwright
menjalankan backend dan frontend production pada 4000/3100. Tidak menggunakan ulang server
development. Dua test mencakup alur CRUD→order→stock error→history snapshot→logout,
session restore, proteksi route, navigasi mobile, loading/empty/error/retry dan expiry.
`E2E_DATABASE_URL` opsional, wajib DB terpisah berakhiran `_test`. Artefak screenshot/trace
masuk folder test-results, diabaikan Git. Test E2E dapat menambah data berprefix E2E hanya
di DB E2E; tidak mengubah database demo utama.

## API documentation

- [Swagger UI lokal](http://localhost:4000/api/docs/) — root http://localhost:4000 juga mengarah ke Swagger.
- [OpenAPI JSON](http://localhost:4000/api/openapi.json).
- [Kontrak endpoint, payload, response, status, dan auth](docs/api/README.md).
- [Postman collection](docs/api/order-management.postman_collection.json).
- [PRD lengkap](dev-plan/PRD.md) dan [hasil eksekusi](dev-plan/EXECUTION.md).

Semua response bisnis JSON menggunakan `{success,message,data,meta?}` atau
`{success:false,message,errors?}`. DELETE 204 tanpa body. Error stok seperti
`errors["items.1.quantity"]` langsung dipetakan ke form baris terkait.

### Menguji API melalui Swagger

1. Buka **http://localhost:4000** atau **http://localhost:4000/api/docs/**.
2. Pilih **Authentication → POST /auth/login → Try it out**. Isi email/password dari
   environment seeder lokal, lalu klik **Execute**.
3. Salin `data.access_token` dari respons, klik **Authorize**, dan isi **bearerAuth** dengan
   token tersebut tanpa menambahkan awalan `Bearer`.
4. Uji endpoint bisnis. Pada **POST /orders**, pilih contoh order sukses, stok kurang,
   quantity tidak valid, atau produk duplikat. Sesuaikan ID dengan data yang tersedia.
5. Untuk menguji akses tanpa token, hapus otorisasi melalui dialog **Authorize**, lalu
   jalankan endpoint bisnis dan periksa respons **401**.

Refresh cookie HttpOnly dikirim otomatis oleh browser yang sama. Setelah menjalankan
`POST /auth/refresh`, perbarui Bearer token dari respons. Otentikasi Swagger tidak disimpan
secara persisten setelah reload. Halaman dokumentasi dan JSON spesifikasi dapat dibuka tanpa
login; endpoint bisnis tetap dilindungi middleware autentikasi.

Source kontrak berada di `apps/backend/src/docs/openapi.ts` dan diuji menggunakan Swagger
Parser. Jika menambahkan endpoint, sesuaikan kontrak serta test dokumentasinya. Browser origin
yang diizinkan adalah `FRONTEND_URL` dan origin dari `API_PUBLIC_URL`. Untuk development,
default-nya port 3200 dan 4000; Compose mengisi `API_PUBLIC_URL` dari root `PUBLIC_API_URL`.

## Docker Compose seluruh service (bonus)

```sh
pnpm env:setup
docker compose up --build -d --wait
```

Migration dan seed dijalankan otomatis sebelum backend listen. PostgreSQL memakai volume
existing `azatech_pgdata`; container aplikasi berjalan sebagai user non-root. Untuk development
lokal, `pnpm db:up` hanya menyalakan database. Hentikan service lokal pada 3200/4000 sebelum
menyalakan container full stack. Root `.env.example` mendokumentasikan override port/origin.
Docker database memakai kredensial demo lokal yang sama dengan baseline, bukan secret pribadi.

**Status verifikasi Docker:** image backend dan frontend berhasil dibangun. Ketiga service
berstatus **healthy**. Login melalui browser, pemulihan sesi setelah reload, navigasi halaman,
akses API, logout, dan pencabutan token telah diverifikasi terhadap container yang berjalan.

| Service    | Container                  | Akses dari host           |
| ---------- | -------------------------- | ------------------------- |
| Frontend   | `azatech-order-frontend-1` | http://localhost:3200     |
| Backend    | `azatech-order-backend-1`  | http://localhost:4000/api |
| PostgreSQL | `azatech-postgres`         | localhost:5434            |

Dockerfile membatasi install dependency sesuai service dan menyimpan unduhan melalui cache
BuildKit. Frontend memakai cache terpisah dengan pemeriksaan integritas paket native. Compose
menunggu PostgreSQL, backend, dan frontend sehat sebelum perintah `--wait` selesai.

Compose membaca kredensial seeder dari root `.env`; `pnpm env:setup` mengisi nilai yang belum
ada dari environment backend. File environment lokal tidak disalin ke image. Data existing
tetap berada di named volume dan seed tidak mereset akun atau transaksi yang sudah ada.

Untuk melihat status/log, menjeda service, dan menjalankannya kembali memakai image existing:

```sh
docker compose ps
docker compose logs -f backend frontend
docker compose stop
docker compose up -d --wait
```

Pada environment pengujian Windows, disk image Docker telah dipindahkan ke drive D setelah
drive C kehabisan ruang. Masalah cache native SWC setelah kegagalan disk penuh diselesaikan
dengan membangun ulang dependency frontend dari cache terpisah. Detail diagnosis dan hasil
verifikasi tercatat di `dev-plan/EXECUTION.md`.

## CI (bonus)

`.github/workflows/ci.yml` menyediakan PostgreSQL service, environment setup, migration/seed,
format check, type-check, integration tests, production build, dan Playwright. Workflow belum dieksekusi
oleh GitHub pada tahap lokal ini; hasil lokal dicatat terpisah di dev-plan/EXECUTION.md.

## Asumsi, keterbatasan, dan perbaikan jika ada waktu lebih

### Asumsi bisnis

- Satu role admin; seluruh order tersimpan dianggap penjualan final. Dashboard all-time;
  produk terlaris berdasarkan total quantity, termasuk produk yang sudah diarsipkan.
- Produk duplikat di satu order ditolak, bukan digabung. Kode produk diarsipkan tidak reusable.
- Stock pada form edit adalah penyesuaian absolut oleh admin. Inventory ledger/audit log
  untuk penyesuaian manual belum menjadi scope.
- Satu order dapat berisi banyak produk, tanpa pajak, diskon, pembayaran, pengiriman, atau retur.
- Zona waktu bisnis adalah Asia/Jakarta; nama produk/pelanggan di riwayat mengikuti master,
  sedangkan harga transaksi tetap menggunakan snapshot.

### Keterbatasan saat ini

- Nomor order maksimal 9999/hari; lebih dari itu ditolak 409. ID number dibatasi safe integer.
- Refresh rotation menggunakan cookie same-site. Sinkronisasi refresh lintas tab belum
  ditambahkan; satu refresh token lama hanya dapat dipakai sekali.
- Tidak ada idempotency key order. Submit UI dicegah saat request berjalan, tetapi retry
  manual setelah jaringan putus perlu memeriksa riwayat terlebih dahulu. Idempotency key
  adalah peningkatan berikutnya.
- Belum ada grafik penjualan harian dan export CSV/Excel (bonus opsional).

### Prioritas perbaikan berikutnya

1. **Idempotency key order** untuk melindungi retry setelah respons terputus tanpa membuat order ganda.
2. **Inventory ledger dan audit log** untuk menelusuri perubahan stok manual maupun penjualan.
3. **Sinkronisasi refresh lintas tab** dan rate limiting terdistribusi untuk pengelolaan sesi.
4. **Pagination low-stock, trigram index, dan cursor pagination** bila volume data bertambah.
5. **Optimasi delivery dan observability**: image Docker multi-stage/pruned, logging terstruktur,
   metrik transaksi, dan pengujian browser tambahan.
6. **Bonus pelaporan**: grafik penjualan harian dan export CSV/Excel setelah fitur inti stabil.

## AI Usage

**OpenCode (OpenAI)** digunakan untuk analisis PDF/repository, penyusunan PRD, implementasi
backend/frontend, integration/E2E tests, serta dokumentasi. **Context7** digunakan untuk
referensi dokumentasi library. Seluruh kode tetap menjadi tanggung jawab kandidat;
kandidat perlu memahami dan mampu menjelaskan/memodifikasi alur auth, transaksi, locking,
snapshot harga, query, cache frontend, dan test saat sesi review.

## Pengumpulan

Repository harus public dengan commit bertahap. Kirim link ke `recruitment@azatech.id`
dengan subject `[Medior Fullstack Developer] Technical Result_[Nama Anda]`.
Lihat checklist hasil eksekusi untuk verifikasi lokal dan langkah pengumpulan yang perlu dilakukan.
