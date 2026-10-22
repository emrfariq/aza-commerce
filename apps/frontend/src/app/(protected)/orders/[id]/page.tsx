"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Plus, ReceiptText } from "lucide-react";
import { api } from "@/lib/api";
import type { Order } from "@/lib/types";
import { rupiah, tanggal } from "@/lib/format";
import { ErrorState, Loading, PageTitle } from "@/components/ui";

/**
 * Mengambil ID dari URL dan menampilkan detail order, informasi pelanggan, serta harga item yang
 * tersimpan saat transaksi.
 */
export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const query = useQuery({
    queryKey: ["orders", id],
    queryFn: /* Mengambil detail order berdasarkan parameter ID halaman. */ () =>
      api<Order>(`/orders/${id}`),
  });
  if (query.isPending)
    return (
      <div className="panel">
        <Loading />
      </div>
    );
  if (query.isError)
    return (
      <div className="panel">
        <ErrorState
          error={query.error}
          retry={
            /* Mencoba memuat ulang detail order setelah query gagal. */ () => void query.refetch()
          }
        />
        <Link className="back-link p-6" href="/orders">
          Kembali ke riwayat
        </Link>
      </div>
    );
  const order = query.data.data;
  return (
    <>
      <Link href="/orders" className="back-link">
        <ArrowLeft size={16} />
        Riwayat order
      </Link>
      <PageTitle
        eyebrow="DETAIL TRANSAKSI"
        title={order.order_number}
        description={`Dicatat pada ${tanggal(order.order_date, true)} WIB`}
        action={
          <Link className="btn secondary" href="/orders/new">
            <Plus size={17} />
            Order baru
          </Link>
        }
      />
      <div className="notice success">
        <CheckCircle2 size={19} />
        <span>Transaksi berhasil dicatat. Stok produk sudah diperbarui.</span>
      </div>
      <section className="panel invoice">
        <div className="invoice-top">
          <div>
            <span className="invoice-icon">
              <ReceiptText size={26} />
            </span>
            <h2>Ringkasan transaksi</h2>
            <p className="muted">{order.order_number}</p>
          </div>
          <span className="badge success">
            <span className="dot" />
            Tercatat
          </span>
        </div>
        <div className="invoice-parties">
          <div>
            <span className="section-tag">PELANGGAN</span>
            <h3>{order.customer.customer_name}</h3>
            <p>{order.customer.customer_address}</p>
            <p>{order.customer.phone || "Nomor telepon tidak diisi"}</p>
            {order.customer.deleted_at && (
              <span className="badge neutral">Pelanggan diarsipkan</span>
            )}
          </div>
          <div>
            <span className="section-tag">INFORMASI ORDER</span>
            <p>
              <span>Tanggal</span>
              <strong>{tanggal(order.order_date, true)} WIB</strong>
            </p>
            <p>
              <span>Dibuat oleh</span>
              <strong>{order.creator.name}</strong>
            </p>
            <p>
              <span>Jumlah produk</span>
              <strong>{order.items.length} item</strong>
            </p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Produk</th>
                <th className="text-right">Harga saat transaksi</th>
                <th className="text-right">Jumlah</th>
                <th className="text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map(
                /*
                 * Menampilkan satu item order dengan harga satuan dan subtotal snapshot dari
                 * server.
                 */
                (item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="cell-stack">
                        <strong>{item.product.product_name}</strong>
                        <small className="muted">
                          {item.product.product_code}
                          {item.product.deleted_at ? " · Diarsipkan" : ""}
                        </small>
                      </div>
                    </td>
                    <td className="text-right">{rupiah(item.unit_price)}</td>
                    <td className="text-right">{item.quantity}</td>
                    <td className="text-right font-semibold">{rupiah(item.subtotal)}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
        <div className="invoice-bottom">
          <p className="muted">
            Harga tersimpan sesuai waktu transaksi.
            <br />
            Perubahan harga katalog tidak memengaruhi order ini.
          </p>
          <div>
            <span>Total penjualan</span>
            <strong>{rupiah(order.total_amount)}</strong>
          </div>
        </div>
      </section>
    </>
  );
}
