import { Prisma } from "@prisma/client";

/**
 * Mengubah hasil Prisma secara rekursif menjadi data JSON publik: nama field snake_case, Decimal
 * berupa string dua desimal, Date berupa ISO, dan BigInt berupa number yang aman. Tanggal lahir
 * dikirim tanpa komponen waktu.
 */
export function toApi(value: unknown, key = ""): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") {
    const id = Number(value);
    if (!Number.isSafeInteger(id)) throw new Error("ID exceeds supported safe integer range");
    return id;
  }
  if (value instanceof Prisma.Decimal) return value.toFixed(2);
  if (value instanceof Date)
    return key === "birthDate" ? value.toISOString().slice(0, 10) : value.toISOString();
  if (Array.isArray(value))
    return value.map(
      /*
       * Menserialisasi setiap elemen array, termasuk objek atau array bertingkat.
       */
      (item) => toApi(item),
    );
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(
        /*
         * Mengubah nama dan nilai setiap properti sebelum menyusunnya kembali menjadi objek.
         */
        ([field, item]) => [
          field.replace(
            /[A-Z]/g,
            /*
             * Mengganti huruf kapital dengan garis bawah dan huruf kecil untuk menghasilkan
             * snake_case.
             */
            (char) => `_${char.toLowerCase()}`,
          ),
          toApi(item, field),
        ],
      ),
    );
  }
  return value;
}
