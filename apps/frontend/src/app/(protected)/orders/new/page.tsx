"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { ApiError, api } from "@/lib/api";
import type { Customer, Order, Product } from "@/lib/types";
import { cents, fromCents, rupiah } from "@/lib/format";
import { ErrorMessage, FieldError, PageTitle } from "@/components/ui";
import Picker from "@/components/picker";

type Line = { key: number; product: Product | null; quantity: number };
/**
 * Mengelola form order dengan pelanggan dan beberapa baris produk. Frontend menampilkan
 * pratinjau harga memakai BigInt, sedangkan validasi stok dan harga final tetap dilakukan
 * backend.
 */
export default function NewOrderPage() {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [lines, setLines] = useState<Line[]>([{ key: 1, product: null, quantity: 1 }]);
  const [nextKey, setNextKey] = useState(2);
  const [localError, setLocalError] = useState<unknown>(null);
  const client = useQueryClient();
  const router = useRouter();
  const mutation = useMutation({
    mutationFn:
      /*
       * Mengirim ID pelanggan, ID produk, dan kuantitas tanpa harga dari browser agar
       * backend menghitung nilai transaksi dari database.
       */
      () =>
        api<Order>("/orders", {
          method: "POST",
          body: JSON.stringify({
            customer_id: customer!.id,
            items: lines.map(
              /*
               * Mengubah baris form menjadi pasangan product_id dan quantity yang dibutuhkan
               * API.
               */
              (line) => ({ product_id: line.product!.id, quantity: line.quantity }),
            ),
          }),
        }),
    onSuccess:
      /*
       * Menyegarkan cache setelah order dibuat lalu membuka detail dengan penanda bahwa
       * pembuatan berhasil.
       */
      async (result) => {
        await client.invalidateQueries();
        router.push(`/orders/${result.data.id}?created=1`);
      },
  });
  const error = localError || mutation.error;
  /**
   * Menghitung subtotal pratinjau dalam satuan perseratus untuk produk dan kuantitas valid;
   * baris belum lengkap bernilai nol.
   */
  const subtotal = (line: Line) =>
    line.product && Number.isInteger(line.quantity) && line.quantity > 0
      ? cents(line.product.price) * BigInt(line.quantity)
      : 0n;
  const total = lines.reduce(
    /*
     * Menjumlahkan seluruh subtotal BigInt menjadi total pratinjau order.
     */
    (sum, line) => sum + subtotal(line),
    0n,
  );
  /**
   * Memperbarui satu baris berdasarkan key stabil sekaligus membersihkan error validasi dan
   * mutation sebelumnya.
   */
  function update(key: number, patch: Partial<Line>) {
    /** Membentuk state baris baru berdasarkan state terbaru tanpa mengubah array lama. */
    setLines((old) =>
      old.map(
        /* Menggabungkan perubahan hanya pada baris dengan key yang sesuai. */ (line) =>
          line.key === key ? { ...line, ...patch } : line,
      ),
    );
    setLocalError(null);
    mutation.reset();
  }
  /**
   * Memvalidasi pelanggan, pilihan produk, dan kuantitas di browser lalu menjalankan mutation
   * jika tidak ada error lokal.
   */
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    const errors: Record<string, string[]> = {};
    if (!customer) errors.customer_id = ["Pilih pelanggan terlebih dahulu"];
    /** Mengumpulkan error per baris dengan path yang sama seperti respons validasi backend. */
    lines.forEach((line, index) => {
      if (!line.product) errors[`items.${index}.product_id`] = ["Pilih produk terlebih dahulu"];
      if (!Number.isInteger(line.quantity) || line.quantity < 1)
        errors[`items.${index}.quantity`] = ["Jumlah minimal 1 dan harus bilangan bulat"];
    });
    if (Object.keys(errors).length) {
      setLocalError(new ApiError("Lengkapi data order terlebih dahulu", 422, errors));
      return;
    }
    mutation.mutate();
  }
  return (
    <>
      <Link href="/orders" className="back-link">
        <ArrowLeft size={16} />
        Riwayat order
      </Link>
      <PageTitle
        eyebrow="TRANSAKSI PENJUALAN"
        title="Buat order baru"
        description="Pilih pelanggan, tambahkan produk, dan catat penjualan Anda."
      />
      <form onSubmit={submit}>
        <fieldset disabled={mutation.isPending}>
          <div className="order-layout">
            <div className="order-main">
              <section className="panel order-section">
                <div className="step-heading">
                  <span>01</span>
                  <div>
                    <h2>Informasi pelanggan</h2>
                    <p className="muted">Siapa yang melakukan pembelian?</p>
                  </div>
                </div>
                <label className="field-label">Pelanggan</label>
                <Picker<Customer>
                  kind="customers"
                  value={customer}
                  label="Pilih pelanggan"
                  onChange={
                    /*
                     * Mengganti pelanggan terpilih dan membersihkan error order sebelumnya.
                     */
                    (value) => {
                      setCustomer(value);
                      setLocalError(null);
                      mutation.reset();
                    }
                  }
                  disabled={mutation.isPending}
                />
                <FieldError name="customer_id" error={error} />
                {customer && (
                  <div className="customer-info">
                    <span className="customer-avatar">{customer.customer_name.charAt(0)}</span>
                    <div>
                      <strong>{customer.customer_name}</strong>
                      <p>
                        {customer.customer_address}
                        {customer.phone ? ` · ${customer.phone}` : ""}
                      </p>
                    </div>
                  </div>
                )}
              </section>
              <section className="panel order-section">
                <div className="step-heading">
                  <span>02</span>
                  <div>
                    <h2>Item pesanan</h2>
                    <p className="muted">Tambahkan satu atau lebih produk ke order.</p>
                  </div>
                </div>
                <FieldError name="items" error={error} />
                <div className="order-lines">
                  {lines.map(
                    /*
                     * Membentuk input produk dan kuantitas untuk setiap baris order dengan
                     * key yang stabil.
                     */
                    (line, index) => (
                      <div className="order-line" key={line.key}>
                        <div className="line-heading">
                          <span>ITEM {String(index + 1).padStart(2, "0")}</span>
                          <button
                            type="button"
                            className="icon-btn danger-text"
                            aria-label={`Hapus item ${index + 1}`}
                            disabled={lines.length === 1 || mutation.isPending}
                            onClick={
                              /*
                               * Menghapus baris yang dipilih dan membersihkan error agar
                               * sesuai dengan susunan form terbaru.
                               */
                              () => {
                                /**
                                 * Menghasilkan daftar baris terbaru setelah baris terpilih
                                 * dikeluarkan.
                                 */
                                setLines((old) =>
                                  old.filter(
                                    /*
                                     * Mempertahankan semua baris selain baris dengan key
                                     * yang akan dihapus.
                                     */
                                    (item) => item.key !== line.key,
                                  ),
                                );
                                mutation.reset();
                                setLocalError(null);
                              }
                            }
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="order-line-fields">
                          <div className="line-product">
                            <label className="field-label">Produk</label>
                            <Picker<Product>
                              kind="products"
                              value={line.product}
                              label={`Pilih produk item ${index + 1}`}
                              onChange={
                                /*
                                 * Memperbarui produk pada baris yang dipilih melalui helper
                                 * update.
                                 */
                                (value) => update(line.key, { product: value })
                              }
                              excluded={lines
                                .filter(
                                  /*
                                   * Mengambil baris lain yang sudah memiliki produk untuk
                                   * mencegah pemilihan produk ganda.
                                   */
                                  (item) => item.key !== line.key && item.product,
                                )
                                .map(
                                  /*
                                   * Mengambil ID produk yang perlu dikecualikan dari pilihan
                                   * pada baris ini.
                                   */
                                  (item) => item.product!.id,
                                )}
                              disabled={mutation.isPending}
                            />
                            <FieldError name={`items.${index}.product_id`} error={error} />
                            {line.product && (
                              <small className="muted">
                                {rupiah(line.product.price)} / unit · {line.product.stock} tersedia
                              </small>
                            )}
                          </div>
                          <div className="line-qty">
                            <label htmlFor={`qty-${line.key}`}>Jumlah</label>
                            <input
                              id={`qty-${line.key}`}
                              type="number"
                              required
                              min="1"
                              max="2147483647"
                              step="1"
                              value={Number.isNaN(line.quantity) ? "" : line.quantity}
                              onChange={
                                /* Memperbarui kuantitas menggunakan nilai numerik dari input. */ (
                                  event,
                                ) => update(line.key, { quantity: event.target.valueAsNumber })
                              }
                            />
                            <FieldError name={`items.${index}.quantity`} error={error} />
                          </div>
                          <div className="line-total">
                            <span className="field-label">Subtotal</span>
                            <strong>{rupiah(fromCents(subtotal(line)))}</strong>
                          </div>
                        </div>
                      </div>
                    ),
                  )}
                </div>
                <button
                  type="button"
                  className="btn add-line"
                  disabled={lines.length >= 100 || mutation.isPending}
                  onClick={
                    /*
                     * Menambahkan baris kosong dengan key baru dan membersihkan error
                     * mutation sebelumnya.
                     */
                    () => {
                      /** Menambahkan baris produk baru ke salinan array state terakhir. */
                      setLines((old) => [...old, { key: nextKey, product: null, quantity: 1 }]);
                      setNextKey(nextKey + 1);
                      mutation.reset();
                    }
                  }
                >
                  <Plus size={17} />
                  Tambah produk
                </button>
              </section>
            </div>
            <aside className="panel order-summary">
              <span className="section-tag">SEBELUM DISIMPAN</span>
              <h2>Ringkasan order</h2>
              <div className="summary-lines">
                {lines
                  .filter(
                    /*
                     * Memilih hanya baris yang sudah mempunyai produk untuk ringkasan
                     * belanja.
                     */
                    (line) => line.product,
                  )
                  .map(
                    /*
                     * Menampilkan nama produk, kuantitas, dan subtotal pada ringkasan order.
                     */
                    (line) => (
                      <div key={line.key}>
                        <span>
                          {line.product!.product_name}
                          <small>× {Number.isNaN(line.quantity) ? 0 : line.quantity}</small>
                        </span>
                        <strong>{rupiah(fromCents(subtotal(line)))}</strong>
                      </div>
                    ),
                  )}
              </div>
              <div className="summary-row">
                <span>Total item</span>
                <strong>
                  {
                    lines.filter(
                      /*
                       * Menghitung hanya baris dengan produk terpilih sebagai jumlah produk
                       * pada ringkasan.
                       */
                      (line) => line.product,
                    ).length
                  }{" "}
                  produk
                </strong>
              </div>
              <div className="summary-total">
                <span>Total penjualan</span>
                <strong>{rupiah(fromCents(total))}</strong>
              </div>
              <ErrorMessage error={error} />
              <button type="submit" className="btn w-full" disabled={mutation.isPending}>
                <Check size={18} />
                {mutation.isPending ? "Menyimpan order…" : "Simpan order"}
              </button>
              <Link
                className="btn secondary w-full"
                href="/orders"
                aria-disabled={mutation.isPending}
                onClick={
                  /*
                   * Mencegah navigasi lewat tautan saat penyimpanan order masih berjalan.
                   */
                  (event) => {
                    if (mutation.isPending) event.preventDefault();
                  }
                }
              >
                Batal
              </Link>
              <p className="secure-note">
                <ShieldCheck size={17} />
                Harga dan stok divalidasi kembali oleh server saat order disimpan.
              </p>
            </aside>
          </div>
        </fieldset>
      </form>
    </>
  );
}
