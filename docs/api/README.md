# REST API

## Swagger UI dan OpenAPI

- Buka **http://localhost:4000** atau **http://localhost:4000/api/docs/**.
- Spesifikasi JSON tersedia di **http://localhost:4000/api/openapi.json**.
- Dokumentasi memuat seluruh 19 operasi API, schema, parameter, response envelope,
  status/error, dan contoh order sukses maupun gagal.
- Jalankan login melalui **Try it out**, salin `data.access_token`, lalu isi **Authorize →
  bearerAuth** dengan token tanpa awalan `Bearer`.
- Login/refresh menggunakan cookie browser otomatis. Token Bearer diperbarui manual setelah
  refresh dan tidak disimpan permanen oleh UI. Dokumentasi tidak berisi kredensial seeder.
- Dokumentasi merupakan endpoint publik; semua endpoint bisnis tetap membutuhkan autentikasi.

## Postman collection

Base URL: `http://localhost:4000/api`. Import
[`order-management.postman_collection.json`](order-management.postman_collection.json)
ke Postman. Jalankan folder berurutan; collection menyimpan access token dan ID resource
otomatis, menggunakan cookie jar untuk refresh, dan membersihkan master demo setelah order.
Isi variable `email` dan `password` secara lokal dari `SEED_ADMIN_EMAIL` dan
`SEED_ADMIN_PASSWORD` di `apps/backend/.env`; collection yang disimpan di Git sengaja kosong.
Collection runner mengubah
data demo; gunakan database lokal/test, bukan database operasional.

## Autentikasi

`POST /auth/login` menerima `{ "email": "<SEED_ADMIN_EMAIL>", "password": "<SEED_ADMIN_PASSWORD>" }`.
Ganti placeholder dengan nilai dari environment lokal; tidak ada akun/password tetap dalam source.
Respons `data` berisi `access_token`, `expires_in:900`, dan `user:{id,name,email}`.
Refresh JWT diberikan lewat cookie `refresh_token` **HttpOnly**, SameSite=Lax,
path `/api/auth`, berlaku7 hari; Secure pada production. Bukan JSON/localStorage.

Semua endpoint bisnis memakai `Authorization: Bearer <access_token>`.
`POST /auth/refresh` diautentikasi menggunakan refresh cookie (tanpa access token).
Refresh merotasi hash/token; refresh lama tidak dapat dipakai lagi.
`POST /auth/logout` membutuhkan Bearer dan mencabut sesi saat ini; token access sesi
tersebut langsung ditolak. `GET /auth/me` mengembalikan profil tanpa password.
Browser harus memakai `credentials: include`. Origin browser pada auth harus sesuai
`FRONTEND_URL` atau origin `API_PUBLIC_URL` untuk Swagger; request tanpa Origin (Postman/CLI)
diizinkan. Gunakan HTTPS dengan domain
same-site pada deployment; konfigurasi lintas situs berbeda memerlukan strategi cookie/CSRF lain.

## Endpoint dan query

| Method         | Path               | Keterangan                            |
| -------------- | ------------------ | ------------------------------------- |
| POST           | /auth/login        | Login,200                             |
| POST           | /auth/refresh      | Refresh cookie,200                    |
| POST           | /auth/logout       | Revoke sesi,200                       |
| GET            | /auth/me           | Profil,200                            |
| GET            | /health            | Protected health,200 (tanpa token401) |
| GET            | /products          | page,per_page,search,sort             |
| POST           | /products          | Create,201                            |
| GET/PUT/DELETE | /products/{id}     | Read/update200; soft delete204        |
| GET            | /customers         | page,per_page,search                  |
| POST           | /customers         | Create,201                            |
| GET/PUT/DELETE | /customers/{uuid}  | Read/update200; soft delete204        |
| GET            | /orders            | page,per_page,from,to,customer_id     |
| POST           | /orders            | Create atomik,201                     |
| GET            | /orders/{id}       | Detail200                             |
| GET            | /dashboard/summary | Summary200                            |

Pagination default page1/per_page10, maksimum100. Search case-insensitive.
Sort produk: `product_name`, `-product_name`, `price`, `-price`, `stock`, `-stock`.
Riwayat default terbaru. `from/to` memakai tanggal `YYYY-MM-DD` inklusif di Asia/Jakarta;
backend menggunakan `>= awal hari`, `< awal hari sesudah to`. `from>to` ditolak422.
Tidak ada edit/delete order. Endpoint master hanya mengembalikan resource aktif;
detail/list order tetap membaca relasi soft-deleted.

## Request master data

Create dan PUT produk menerima seluruh editable fields:

```json
{ "product_code": "P0021", "product_name": "Teh Melati", "stock": 10, "price": "12000.50" }
```

Kode wajib unik<=20, nama wajib<=150, stok integer0..2147483647,
harga positif maksimal9999999999.99 dengan2 desimal. Harga juga boleh number, tetapi string
direkomendasikan. Kode produk soft-deleted tetap reserved. Stock pada PUT adalah penyesuaian
stok absolut yang disengaja oleh admin, bukan penambahan stok.

```json
{
  "customer_name": "Budi Santoso",
  "customer_address": "Jakarta",
  "gender": "Pria",
  "birth_date": "1995-02-10",
  "phone": "081234567890"
}
```

Nama/alamat wajib<=150/255, gender Pria/Wanita, tanggal kalender valid tidak di masa depan.
Phone opsional/null<=20 dan string agar nol awal tidak hilang. ID customer UUID dibuat server.
Unknown body fields ditolak, termasuk di PUT.

## Order

```json
{
  "customer_id": "00000000-0000-4000-8000-000000000001",
  "items": [
    { "product_id": 1, "quantity": 2 },
    { "product_id": 3, "quantity": 1 }
  ]
}
```

Minimal1/maksimal100 produk berbeda, quantity integer positif. Produk duplikat ditolak.
Customer/produk harus aktif. Jangan kirim `price`, `unit_price`, `subtotal`, `total_amount`,
`created_by`, `order_number`, atau `order_date`: schema strict menolaknya.
Nomor server `INV-YYYYMMDD-XXXX` (maksimal9999/hari). Harga dan total dihitung di database
transaction menggunakan Decimal, lalu unit_price disimpan sebagai snapshot.

Respons order mencakup fields orders, `customer`, `creator:{id,name,email}`,
`items:[{id,order_id,product_id,quantity,unit_price,subtotal,product,...timestamps}]`.
List order menyertakan `customer` dan `_count:{items}`, bukan seluruh item detail.

## Envelope dan tipe data

Kontrak envelope berlaku untuk endpoint bisnis. `/api/openapi.json` mengembalikan dokumen
OpenAPI mentah agar dapat dibaca Swagger UI dan tooling dokumentasi.

```json
{
  "success": true,
  "message": "OK",
  "data": [],
  "meta": { "page": 1, "per_page": 10, "total": 0, "total_pages": 0 }
}
```

Detail/create/update memakai object `data` dan tidak memiliki meta. Delete204 tidak memiliki
body. Bigint IDs diserialisasi sebagai number dan dibatasi safe integer JS. Nominal uang selalu
string2 desimal (contoh `"24001.00"`). Timestamp ISO8601 UTC, birth_date `YYYY-MM-DD`.
Semua field publik snake_case. Password dan hash token tidak pernah masuk DTO publik.

```json
{
  "success": false,
  "message": "Stok atau produk tidak tersedia",
  "errors": { "items.1.quantity": ["Stok Hydrococo tersisa 3, diminta 5"] }
}
```

Indeks item **zero-based sesuai urutan request**, meskipun lock produk diurutkan berdasarkan ID.
Kesalahan root memakai key `_`. Kode unik duplicate409 dengan `errors.product_code`.

| Status      | Makna                                                               |
| ----------- | ------------------------------------------------------------------- |
| 200/201/204 | Sukses sesuai operasi                                               |
| 400         | JSON malformed                                                      |
| 401         | Token hilang/invalid/expired/revoked, kredensial salah              |
| 403         | Origin browser auth ditolak                                         |
| 404         | Resource/route tidak ditemukan                                      |
| 409         | Duplicate unik, batas nomor harian, konflik transaksi setelah retry |
| 413         | Body lebih besar100KB                                               |
| 422         | Validasi field, stok kurang, master tidak aktif                     |
| 500         | Error internal; detail tidak dibocorkan                             |

## Dashboard

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "total_transactions": 30,
    "total_sales": "1000000.00",
    "top_products": [
      {
        "product": {
          "id": 1,
          "product_code": "P0001",
          "product_name": "Contoh",
          "price": "12000.00",
          "stock": 10,
          "deleted_at": null
        },
        "quantity_sold": 15
      }
    ],
    "low_stock_products": []
  }
}
```

Total all-time; ranking berdasarkan SUM(quantity), tie-break ID, maksimal5.
Produk diarsipkan tetap masuk ranking historis; low stock hanya aktif dengan stock<5.
Agregasi menggunakan snapshot konsisten RepeatableRead.
