"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Plus,
  RotateCcw,
} from "lucide-react";
import { api, downloadFile, queryString } from "@/lib/api";
import type { Customer, Order } from "@/lib/types";
import { rupiah, tanggal } from "@/lib/format";
import { Empty, ErrorMessage, ErrorState, Loading, PageTitle, Pagination } from "@/components/ui";
import Picker from "@/components/picker";

/**
 * Menampilkan riwayat order dengan filter tanggal, pelanggan, pagination, dan unduhan CSV atau
 * Excel yang memakai filter yang sama.
 */
export default function OrdersPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [page, setPage] = useState(1);
  const [feedback, setFeedback] = useState("");
  const invalid = Boolean(from && to && from > to);
  const exporting = useMutation({
    mutationFn:
      /*
       * Memulai unduhan format terpilih dengan meneruskan filter tanggal dan pelanggan
       * aktif.
       */
      (format: "csv" | "xlsx") =>
        downloadFile(
          `/orders/export?${queryString({ format, from, to, customer_id: customer?.id })}`,
          `riwayat-order.${format}`,
        ),
    /*
     * Membersihkan pesan unduhan sebelumnya saat proses ekspor baru dimulai.
     */

    onMutate: () => setFeedback(""),
    /*
     * Menampilkan pemberitahuan bahwa unduhan format terpilih sudah dimulai.
     */

    onSuccess: (_result, format) =>
      setFeedback(
        `Unduhan ${format === "xlsx" ? "Excel" : "CSV"} dimulai sesuai filter yang dipilih.`,
      ),
  });
  const list = useQuery({
    queryKey: ["orders", { from, to, customer: customer?.id, page }],
    enabled: !invalid,
    queryFn:
      /*
       * Memuat halaman order sesuai filter aktif; query dinonaktifkan jika rentang tanggal
       * terbalik.
       */
      () => api<Order[]>(`/orders?${queryString({ from, to, customer_id: customer?.id, page })}`),
  });
  return (
    <>
      <PageTitle
        eyebrow="CATATAN PENJUALAN"
        title="Riwayat order"
        description="Telusuri setiap transaksi dan detail penjualan toko Anda."
        action={
          <div className="page-actions">
            <button
              className="btn secondary"
              aria-label="Export CSV"
              disabled={invalid || exporting.isPending}
              onClick={
                /* Menjalankan mutation ekspor dalam format CSV. */ () => exporting.mutate("csv")
              }
            >
              {exporting.isPending && exporting.variables === "csv" ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <Download size={17} />
              )}
              CSV
            </button>
            <button
              className="btn secondary"
              aria-label="Export Excel"
              disabled={invalid || exporting.isPending}
              onClick={
                /* Menjalankan mutation ekspor dalam format XLSX. */ () => exporting.mutate("xlsx")
              }
            >
              {exporting.isPending && exporting.variables === "xlsx" ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <FileSpreadsheet size={17} />
              )}
              Excel
            </button>
            <Link className="btn" href="/orders/new">
              <Plus size={18} />
              Buat order
            </Link>
          </div>
        }
      />
      <ErrorMessage error={exporting.error} />
      {feedback && (
        <div className="notice success" role="status">
          <Check size={18} />
          {feedback}
        </div>
      )}
      <section className="panel">
        <div className="filter-bar">
          <div className="filter-label">
            <CalendarDays size={18} />
            <strong>Filter order</strong>
          </div>
          <label>
            Dari tanggal
            <input
              type="date"
              value={from}
              onChange={
                /*
                 * Mengganti batas tanggal awal dan mengulang daftar dari halaman pertama.
                 */
                (event) => {
                  setFrom(event.target.value);
                  setPage(1);
                }
              }
            />
          </label>
          <label>
            Sampai tanggal
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={
                /*
                 * Mengganti batas tanggal akhir dan mengulang daftar dari halaman pertama.
                 */
                (event) => {
                  setTo(event.target.value);
                  setPage(1);
                }
              }
            />
          </label>
          <div className="customer-filter">
            <label className="field-label">Pelanggan</label>
            <Picker<Customer>
              kind="customers"
              value={customer}
              label="Semua pelanggan"
              onChange={
                /* Mengganti filter pelanggan dan kembali ke halaman pertama. */ (value) => {
                  setCustomer(value);
                  setPage(1);
                }
              }
            />
          </div>
          <button
            className="icon-btn"
            title="Reset filter"
            aria-label="Reset filter"
            onClick={
              /*
               * Mengosongkan seluruh filter lalu kembali ke halaman pertama riwayat.
               */
              () => {
                setFrom("");
                setTo("");
                setCustomer(null);
                setPage(1);
              }
            }
          >
            <RotateCcw size={17} />
          </button>
        </div>
        {invalid ? (
          <div className="notice danger" role="alert">
            Tanggal awal harus sebelum tanggal akhir.
          </div>
        ) : list.isPending ? (
          <Loading />
        ) : list.isError ? (
          <ErrorState
            error={list.error}
            retry={/* Memuat ulang riwayat order setelah query gagal. */ () => void list.refetch()}
          />
        ) : !list.data?.data.length ? (
          <Empty
            title="Belum ada transaksi pada rentang ini"
            description="Sesuaikan filter atau mulai mencatat order baru."
            action={
              <Link href="/orders/new" className="btn secondary">
                Buat order
              </Link>
            }
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>No. order</th>
                  <th>Pelanggan</th>
                  <th>Tanggal transaksi</th>
                  <th>Item</th>
                  <th className="text-right">Total penjualan</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.data.data.map(
                  /*
                   * Membentuk baris tabel riwayat order beserta tautan detail dan nilai
                   * transaksinya.
                   */
                  (order) => (
                    <tr key={order.id}>
                      <td>
                        <Link href={`/orders/${order.id}`} className="order-number">
                          {order.order_number}
                        </Link>
                      </td>
                      <td>
                        <div className="name-cell">
                          <span className="customer-avatar">
                            {order.customer.customer_name.charAt(0)}
                          </span>
                          {order.customer.customer_name}
                        </div>
                      </td>
                      <td>{tanggal(order.order_date, true)}</td>
                      <td>
                        <span className="badge neutral">{order._count?.items ?? 0} produk</span>
                      </td>
                      <td className="text-right font-semibold">{rupiah(order.total_amount)}</td>
                      <td>
                        <Link
                          className="icon-btn"
                          href={`/orders/${order.id}`}
                          aria-label={`Detail ${order.order_number}`}
                        >
                          <ArrowUpRight size={18} />
                        </Link>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
        {!invalid && <Pagination meta={list.data?.meta} onChange={setPage} />}
      </section>
      <p className="page-hint">
        Export mengikuti filter tanggal/pelanggan dan mencakup semua halaman. CSV berisi ringkasan
        per order; Excel juga memuat detail item.
      </p>
    </>
  );
}
