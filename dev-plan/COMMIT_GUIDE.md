# Panduan commit bertahap

Jalankan perintah di bawah **secara manual dari root repository**, satu tahap pada satu waktu.
Setiap tahap mencantumkan path eksplisit. Periksa staged diff sebelum membuat commit.

Format pesan untuk seluruh commit baru mengikuti permintaan kandidat: `feat/judul commit`.
Riwayat awal yang sudah ada tetap menggunakan pesan aslinya.

## Riwayat awal

Tiga commit awal repository:

1. `6bf8202 chore: bootstrap pnpm monorepo with dev postgres compose`
2. `475daae feat(db): add prisma schema, init migration and check constraints`
3. `4e6b6ca feat(api): add standard response envelope and error handler`

Tahapan berikut melanjutkan riwayat tersebut. Status pelaksanaan dan hasil verifikasi
dicatat di [EXECUTION.md](EXECUTION.md); periksa `git log` sebelum mengulangi perintah commit.

## Aturan staging

- Hindari `git add .`, `git add -A`, `git add --all`, dan `git commit -a`.
- Stage hanya file yang disebutkan pada tahap yang sedang dikerjakan.
- Jika sudah ada file staged dari pekerjaan lain, tinjau terlebih dahulu dengan
  `git diff --cached --name-only`. Unstage hanya path yang tidak sesuai tahap menggunakan
  `git restore --staged -- <path>`; isi working tree tetap tersimpan.
- Untuk membagi beberapa perubahan dalam satu file, gunakan `git add -p -- <path>`.
  Pilih `y` untuk hunk yang relevan, `n` untuk melewati, atau `s` untuk memecah hunk.
- Jangan stage file `.env` atau menyalin nilai kredensialnya ke commit message/dokumentasi.

### Pemeriksaan wajib sebelum setiap commit

Setelah `git add` pada suatu tahap, jalankan:

```sh
git diff --cached --name-only
git diff --cached --stat
git diff --cached
git diff --cached --check
```

Pastikan daftar file dan isi diff hanya berkaitan dengan unit kerja tersebut. Jika ada file
yang salah masuk, unstage path itu, lalu ulangi pemeriksaan. Setelah itu jalankan perintah
`git commit` pada tahap terkait.

## 1. Dokumen requirement dan rencana commit

```sh
git add -- dev-plan/PRD.md dev-plan/COMMIT_GUIDE.md
```

Setelah memeriksa staged diff:

```sh
git commit -m "feat/document requirements and phased delivery"
```

## 2. Konfigurasi workspace, dependency, dan formatter

Manifest dan lockfile disertakan bersama agar daftar dependency konsisten. Tahap ini
menyiapkan perintah pengembangan; implementasi target perintah dilengkapi pada tahap berikutnya.

```sh
git add -- package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.base.json
git add -- .gitignore .gitattributes .prettierignore .prettierrc.json .env.example
git add -- apps/backend/package.json apps/backend/tsconfig.json apps/backend/tsconfig.build.json apps/backend/.env.example
git add -- apps/frontend/package.json apps/frontend/tsconfig.json apps/frontend/next.config.ts apps/frontend/next-env.d.ts apps/frontend/postcss.config.mjs apps/frontend/.env.example
git add -- scripts/setup.mjs
```

Path yang tidak memiliki perubahan tidak akan menambah isi commit.

```sh
git commit -m "feat/configure workspace dependencies and code formatting"
```

## 3. Backend API dan seed data

Semua router backend disertakan bersama karena `src/app.ts` mendaftarkan auth, products,
customers, orders, dan dashboard sekaligus. Ini menghindari commit yang mengimpor modul
yang belum disertakan. Unit ini mencakup satu service backend yang lengkap.

```sh
git add -- apps/backend/src/app.ts apps/backend/src/index.ts
git add -- apps/backend/src/config apps/backend/src/lib apps/backend/src/middlewares
git add -- apps/backend/src/modules apps/backend/src/utils
git add -- apps/backend/prisma/schema.prisma apps/backend/prisma/seed.ts apps/backend/prisma/seed-auth.ts apps/backend/prisma/seeds
git add -- apps/backend/scripts/test.ts apps/backend/tests/api-response.test.ts
```

Migration awal sudah ada pada riwayat sebelumnya. Test fondasi ikut tahap ini karena
fixture-nya disesuaikan dengan proteksi autentikasi endpoint health.

```sh
git commit -m "feat/implement authenticated order management and seed data"
```

Jika ingin memecah tahap backend lebih kecil menjadi auth, master data, lalu orders,
gunakan staging per hunk untuk import dan registrasi router di `apps/backend/src/app.ts`,
bersama dependency/konfigurasi terkait. Jangan stage seluruh versi `app.ts` ketika
modul yang diimpornya belum masuk commit.

## 4. Frontend workspace

```sh
git add -- apps/frontend/src
```

Folder `src` hanya mencakup source frontend: halaman, komponen, API client, tipe data,
formatting uang/tanggal, dan session provider. Environment lokal tidak berada di path ini.

```sh
git commit -m "feat/build responsive admin workspace"
```

## 5. Integration test dan browser E2E

```sh
git add -- apps/backend/tests/integration
git add -- playwright.config.ts tests/e2e
```

```sh
git commit -m "feat/add transaction authentication and browser tests"
```

## 6. Docker dan GitHub Actions

```sh
git add -- .dockerignore docker-compose.yml
git add -- apps/backend/Dockerfile apps/frontend/Dockerfile
git add -- .github/workflows/ci.yml
```

```sh
git commit -m "feat/add container setup and automated quality checks"
```

## 7. Dokumentasi penggunaan dan hasil verifikasi

```sh
git add -- README.md docs/api/README.md docs/api/order-management.postman_collection.json
git add -- dev-plan/EXECUTION.md
```

```sh
git commit -m "feat/document setup API contracts and verification results"
```

## Pemeriksaan akhir

Setelah semua unit implementasi tersedia, jalankan quality checks:

```sh
pnpm format:check
pnpm lint
pnpm test
pnpm build
```

Untuk browser E2E, pastikan server development pada port 4000 sudah dihentikan,
port 3100 kosong, dan browser Playwright terpasang. Ikuti langkah E2E di README.

Tinjau riwayat dan perubahan yang tersisa:

```sh
git log --oneline -12
git status --short
git check-ignore .env apps/backend/.env apps/frontend/.env.local
git ls-files -- .env apps/backend/.env apps/frontend/.env.local
```

Perintah `git ls-files` terakhir seharusnya tidak mengeluarkan path file kredensial.
Jika masih ada perubahan source yang dimaksudkan untuk dikumpulkan, review dan stage
path spesifik tersebut dalam commit yang sesuai, bukan melakukan staging seluruh repository.

`.serena/`, `opencode.json`, dan PDF soal tidak dimasukkan dalam tahapan staging ini.
Evaluasi file tambahan tersebut secara terpisah bila memang ingin menyertakannya.
Jangan menganggap semua untracked file merupakan bagian dari aplikasi.

## Push setelah review lokal

Pastikan remote dan nama branch tujuan sudah benar:

```sh
git remote -v
git branch --show-current
```

Setelah remote repository public disiapkan, ganti placeholder berikut dengan nama branch aktif:

```sh
git push -u origin <nama-branch>
```

Push dilakukan setelah unit commit diperiksa; hindari amend/force-push untuk mengubah
riwayat yang sudah dibagikan. Jika quality check menemukan masalah, perbaiki dengan commit
baru yang spesifik dengan format yang diminta, misalnya `feat/fix order stock validation`.
