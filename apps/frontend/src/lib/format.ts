/**
 * Memformat nilai menjadi mata uang rupiah sesuai locale Indonesia, dengan desimal hanya jika
 * diperlukan.
 */
export const rupiah = (value: string | number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: Number(value) % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(Number(value));
/** Memformat tanggal menurut zona Jakarta dan menambahkan jam bila parameter time bernilai true. */
export const tanggal = (value: string, time = false) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
    ...(time ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value));
// Pratinjau memakai bilangan bulat untuk harga dua desimal; hasil perhitungan server tetap menjadi acuan.
/**
 * Mengubah string harga dua desimal menjadi satuan perseratus dengan BigInt agar pratinjau
 * perhitungan uang tidak memakai pecahan floating-point. Total final tetap dihitung backend.
 */
export function cents(value: string): bigint {
  const [whole = "0", fraction = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0").slice(0, 2));
}
/**
 * Mengubah satuan perseratus BigInt kembali menjadi string nominal dengan tepat dua angka
 * desimal.
 */
export const fromCents = (value: bigint) =>
  `${value / 100n}.${String(value % 100n).padStart(2, "0")}`;
