# PRD — Order Management System

Versi 1.0 · Sumber: `Technical_Test_Medior_Fullstack.pdf` · Track A.
Target pengerjaan technical test: 6 jam efektif, pengumpulan maksimal 1 × 24 jam.

## 1. Ringkasan produk

Aplikasi administrasi online shop bagi admin/operator toko untuk mengelola produk,
pelanggan, dan order multi-item. Backend REST dan frontend merupakan dua service
terpisah. Prioritas: transaksi benar, stok konsisten, kode mudah dijelaskan, dan setup
yang dapat diikuti reviewer. Admin disediakan melalui seed; tidak ada registrasi publik.

Alur utama: login → kelola master data → pilih pelanggan dan produk → simpan order
atomik → lihat detail/riwayat → pantau dashboard.

## 2. Baseline repository

| Area       | Sebelum implementasi                                            | Tindak lanjut                     |
| ---------- | --------------------------------------------------------------- | --------------------------------- |
| Monorepo   | pnpm workspaces, Node >=24                                      | Lanjutkan                         |
| TypeScript | Strict, shared tsconfig                                         | Pertahankan                       |
| Backend    | Express 5, app factory dan entry point                          | Tambahkan modul bisnis            |
| Database   | PostgreSQL 16, Prisma 6.19.3                                    | Pertahankan migration existing    |
| Schema     | users, products, customers, orders, order_items, refresh_tokens | Gunakan dan dokumentasikan        |
| Constraint | CHECK harga/stok/quantity, FK dan index                         | Verifikasi dari DB kosong         |
| API        | Helper envelope, pagination, error handler                      | Gunakan konsisten                 |
| Tests      | Empat test fondasi response                                     | Tambahkan integration test bisnis |
| Seed       | Belum ada; root db:seed sudah direncanakan                      | Implementasikan                   |
| Frontend   | apps/frontend/.gitkeep                                          | Next.js App Router + React 19     |
| Docker     | Database port host 5434                                         | Full stack sebagai bonus          |
| Dokumen    | PDF requirement                                                 | PRD, README, dokumentasi API      |

Struktur awal: apps/backend/{src,prisma,tests}, apps/frontend, dev-plan,
docker-compose.yml, package.json, pnpm-workspace.yaml, tsconfig.base.json.
Perubahan dependency backend dan lockfile yang sudah ada adalah pekerjaan pengguna.

## 3. Tujuan dan ukuran keberhasilan

1. Backend/frontend berjalan terpisah; semua logika bisnis berada di Express.
2. Seluruh fitur wajib PDF dapat dipakai melalui UI.
3. Order multi-item menghitung harga dari server, menyimpan snapshot, dan mengurangi stok tepat.
4. Satu item gagal membatalkan semua penulisan order dan stok.
5. Request bersamaan tidak menyebabkan overselling atau nomor order duplikat.
6. Soft delete tidak merusak riwayat.
7. Migration dan seed bekerja dari DB kosong.
8. Minimal lima feature/integration test lulus, termasuk sukses order, kekurangan stok,
   input invalid, dan tanpa token.
9. README, environment example dan dokumentasi API tersedia; setup sekitar enam perintah.

## 4. Scope

P0 wajib: autentikasi access+refresh token, logout/me, CRUD produk (search/pagination/sort),
CRUD pelanggan (search/pagination), order atomik, riwayat dan filter, detail,
dashboard, seed, integration tests, dokumentasi API, README, responsive UI dan states.

P1 bonus: Docker seluruh service, CI lint/test, grafik harian, export CSV/Excel,
frontend/E2E tests. Bonus tidak menggeser fitur wajib.

Di luar MVP: registrasi, multi-role, checkout publik, payment, pengiriman, diskon,
pajak, retur, edit/pembatalan order.

## 5. Teknologi dan batas arsitektur

- Node.js >=24, pnpm 10 workspaces.
- Express 5 + TypeScript strict, Prisma 6.19.3, PostgreSQL 16.
- Zod, bcryptjs, JWT access dan refresh token, cookie HttpOnly.
- Vitest + Supertest + PostgreSQL test terpisah.
- React 19 + Next.js App Router + TypeScript, TanStack Query, Tailwind CSS.
- Dokumentasi API berupa Postman collection atau OpenAPI yang dapat dijalankan reviewer.
- Next.js tidak menggunakan API Routes/Server Actions sebagai backend bisnis.
- Pisahkan route, schema, service; jangan menambah abstraksi repository tanpa kebutuhan.

Struktur target backend: config/, lib/prisma.ts, middlewares/auth.ts,
modules/{auth,products,customers,orders,dashboard}, prisma/seed.ts, tests/integration/.
Frontend: app/login, app/(protected)/{dashboard,products,customers,orders/new,orders/[id]},
components/, lib/, providers/. Dokumen eksekusi disimpan di dev-plan/.

## 6. Functional requirements dan acceptance criteria

### FR-01 Autentikasi

- Login email/password; password hanya hash. Salah kredensial → 401.
- Access token pendek di memory frontend; refresh JWT di cookie HttpOnly.
- Hash refresh token dan masa berlaku disimpan di refresh_tokens; rotasi saat refresh.
- Refresh memvalidasi refresh credential, bukan mensyaratkan access token hidup.
- Access token membawa session ID; backend memeriksa sesi belum revoked/expired.
- Logout mencabut sesi dan menghapus cookie; token sesi lama ditolak.
- Me tidak membocorkan password/hash. Semua endpoint bisnis wajib autentikasi.
- Saat reload, pulihkan melalui refresh; gagal → login. Loading sebelum konten protected.
- CORS hanya origin frontend terkonfigurasi; mutasi cookie memeriksa origin browser.
- Endpoint /api/health existing diselaraskan menjadi protected; test fondasi diperbarui.

### FR-02 Produk

- CRUD: kode <=20 karakter unik, nama <=150, stock integer >=0, price >0 dengan <=2 desimal.
- Pagination; search nama/kode case-insensitive; sort nama/harga/stok dua arah.
- Soft delete, konfirmasi UI. Produk terhapus tidak selectable/list aktif, tetap tampil di riwayat.
- Kode tidak dapat dipakai ulang setelah delete (constraint existing). Duplicate →409, invalid →422.
- Detail/update/delete resource tidak ada atau terhapus →404.

### FR-03 Pelanggan

- UUID; nama <=150, alamat <=255, gender Pria/Wanita, birth_date valid tidak masa depan,
  phone nullable string <=20. Input wajib tidak kosong.
- CRUD, pagination, search nama; soft delete dan dialog konfirmasi.
- Customer terhapus tidak dapat membuat order baru, riwayat tetap terbaca.
- Form menampilkan error field; ID invalid →422 dan tidak ditemukan →404.

### FR-04 Order

Request hanya customer_id dan items[{product_id,quantity}]. Minimal satu item;
quantity integer positif; customer/produk aktif. Produk duplikat ditolak di baris terkait.
Tolak field harga/total/pembuat/nomor order dari client. created_by dari sesi.

- Ambil harga dari DB; Decimal arithmetic untuk subtotal dan total.
- Simpan unit_price snapshot; perubahan harga sesudahnya tidak mengubah histori.
- Satu DB transaction: lock customer aktif, lock produk urut ID, cek semua stok,
  alokasi nomor, buat order/items, kurangi stok, commit. Error apa pun rollback.
- Lock baris dan retry terbatas untuk konflik transient; tidak ada overselling.
- Nomor INV-YYYYMMDD-XXXX berdasarkan Asia/Jakarta; alokasi harian diserialisasi
  dengan DB lock dan dilindungi unique constraint. Batas 9999/hari → konflik terkontrol.
- Sukses →201; stok tidak cukup →422, errors items.N.quantity dengan indeks request asli.
- Frontend: customer picker, baris dinamis, estimasi subtotal/total, error per item,
  input tetap pada kegagalan, submit disabled saat request, hasil server otoritatif.

### FR-05 Riwayat dan detail

- GET list pagination, from/to/customer_id, default terbaru dengan tie-break ID.
- Rentang tanggal hari Indonesia inklusif (batas akhir hari berikutnya eksklusif).
- from > to →422. Detail menampilkan nomor/tanggal/customer/creator/items/quantity/
  snapshot harga/subtotal/total. Not found →404.
- Riwayat membaca relasi soft-deleted; nama mengikuti master, harga snapshot.

### FR-06 Dashboard

- Total transaksi dan penjualan semua order; total berasal dari total_amount.
- Maksimal lima produk terlaris berdasarkan SUM(quantity), tie-break deterministik.
- Produk terhapus tetap boleh di ranking historis; low stock hanya aktif stock<5 (termasuk 0).
- Tanpa transaksi: nol/empty state. Mutasi menginvalidasi cache terkait.

## 7. Kontrak API

| Method         | Endpoint               | Fungsi                  |
| -------------- | ---------------------- | ----------------------- |
| POST           | /api/auth/login        | Login                   |
| POST           | /api/auth/refresh      | Refresh credential      |
| POST           | /api/auth/logout       | Revoke                  |
| GET            | /api/auth/me           | Profil                  |
| GET/POST       | /api/products          | List/create             |
| GET/PUT/DELETE | /api/products/{id}     | Read/update/soft delete |
| GET/POST       | /api/customers         | List/create             |
| GET/PUT/DELETE | /api/customers/{id}    | Read/update/soft delete |
| GET/POST       | /api/orders            | List/create             |
| GET            | /api/orders/{id}       | Detail                  |
| GET            | /api/dashboard/summary | Summary                 |

JSON snake_case; TS internal camelCase. Page=1, per_page=10 (maksimum100).
Sort allowlist: product_name, -product_name, price, -price, stock, -stock.
Monetary string decimal ("12000.00"); BigInt ID diserialisasi number dengan batas safe integer.
Timestamp ISO8601, birth_date YYYY-MM-DD.

Sukses: {success:true,message:"OK",data:...,meta?:{page,per_page,total,total_pages}}.
Error: {success:false,message:"...",errors?:{"items.1.quantity":["..."]}}.
200 read/update/auth, 201 create, 204 delete tanpa body, 400 malformed JSON,
401 auth, 403 forbidden, 404 missing, 409 konflik, 422 validasi/stok, 500 internal tanpa detail.

## 8. Data dan seed

Pertahankan schema/migration existing; tambahan melalui migration baru.
Seed minimal 1 admin,20 produk,15 customer,30 order dalam30 hari terakhir.
Hash password; petunjuk akun seed melalui environment lokal di README; beberapa stok rendah,
order multi-item, total/stok konsisten. Seeder auth dipisahkan ke modul generik;
kredensial admin tidak hardcoded dan hanya disimpan dalam `.env` yang Git ignored.
Rerun seed harus jelas dan aman (idempotent atau reset demo eksplisit).
Lengkapi script seed dan environment examples. Jelaskan refresh_tokens/index/locking di README.

## 9. UX

Routes: /login,/dashboard,/products,/customers,/orders/new,/orders,/orders/[id].
Sidebar desktop dan navigasi mobile, tabel scroll/card sesuai layar, label form aksesibel,
loading/empty/error/retry yang jelas, field errors, dialog delete, feedback sukses.
Picker dapat mencari data melampaui halaman pertama. Search/filter reset pagination.
Format id-ID: Rp12.000 dan tanggal Indonesia zona Asia/Jakarta. Hindari fetch loop/retry auth.

## 10. Pengujian

DB test terpisah, migration sama, tanpa mock untuk atomicity/concurrency.

| ID   | Skenario                                    | Bukti                                 |
| ---- | ------------------------------------------- | ------------------------------------- |
| IT01 | Order multi-item sukses                     | Data/harga/total/stok benar           |
| IT02 | Item kedua stok kurang                      | 422, semua stok/order rollback        |
| IT03 | Input invalid/tamper harga/duplicate produk | 422 field errors                      |
| IT04 | Tanpa token/expired                         | 401                                   |
| IT05 | Dua request stok terakhir                   | Hanya satu sukses, stok tidak negatif |
| IT06 | Ubah harga                                  | Snapshot tetap                        |
| IT07 | Soft delete master                          | Riwayat tetap; order baru ditolak     |
| IT08 | Refresh/logout                              | Rotasi/revokasi bekerja               |
| IT09 | CRUD/filter/dashboard                       | Pagination/sort/agregasi akurat       |

## 11. Rencana 360 menit

Fondasi15, auth40, CRUD40, order+test65, riwayat/dashboard/seed25,
frontend105, verifikasi45, dokumentasi25. Estimasi, bukan klaim waktu aktual.
Urutan fondasi→auth→master→order→riwayat/dashboard→integrasi→verifikasi→dokumen.
Test ditulis bersama fitur. Bonus setelah P0.

## 12. Definition of done

- [x] Semua endpoint dan UI wajib, auth/refresh/logout.
- [x] Transaksi atomik, concurrency, snapshot, soft-delete history.
- [x] Migration/seed DB kosong, jumlah data benar.
- [x] > =5 integration tests relevan lulus; lint/build kedua service.
- [x] Smoke flow login→CRUD→order→detail→dashboard; desktop/mobile states.
- [x] README stack/alasan/setup~6 perintah/akun demo/test/logika stok/asumsi/batasan/AI Usage.
- [x] Environment examples tanpa secret pribadi, dokumentasi API lengkap.
- [ ] GitHub public dan commit bertahap oleh kandidat; pengiriman recruitment@azatech.id,
      subject [Medior Fullstack Developer] Technical Result\_[Nama Anda].

## 13. Asumsi dan keterbatasan yang didokumentasikan

Admin tunggal; order final tanpa pembatalan; dashboard all-time; duplicate produk ditolak;
kode soft-deleted tidak reusable; nama histori mengikuti master; zona Asia/Jakarta;
9999 nomor/hari; ID number dibatasi safe integer; type-check sebagai lint.
Fitur belum selesai harus jujur di README. AI Usage mencantumkan OpenCode untuk perencanaan,
implementasi, test dan dokumentasi; kandidat wajib memahami serta mampu memodifikasi kode.

## 14. Bobot evaluasi

Fungsional/logika30%, kualitas kode20%, API/database15%, testing15%, frontend/UX10%,
dokumentasi/Git10%. Fokus eksekusi mengikuti bobot tersebut.
