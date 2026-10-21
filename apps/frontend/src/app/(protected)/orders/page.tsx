"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, CalendarDays, Plus, RotateCcw } from "lucide-react";
import { api, queryString } from "@/lib/api";
import type { Customer, Order } from "@/lib/types";
import { rupiah, tanggal } from "@/lib/format";
import { Empty, ErrorState, Loading, PageTitle, Pagination } from "@/components/ui";
import Picker from "@/components/picker";

export default function OrdersPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [page, setPage] = useState(1);
  const invalid = Boolean(from && to && from > to);
  const list = useQuery({
    queryKey: ["orders", { from, to, customer: customer?.id, page }],
    enabled: !invalid,
    queryFn: () =>
      api<Order[]>(`/orders?${queryString({ from, to, customer_id: customer?.id, page })}`),
  });
  return (
    <>
      <PageTitle
        eyebrow="CATATAN PENJUALAN"
        title="Riwayat order"
        description="Telusuri setiap transaksi dan detail penjualan toko Anda."
        action={
          <Link className="btn" href="/orders/new">
            <Plus size={18} />
            Buat order
          </Link>
        }
      />
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
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            Sampai tanggal
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <div className="customer-filter">
            <label className="field-label">Pelanggan</label>
            <Picker<Customer>
              kind="customers"
              value={customer}
              label="Semua pelanggan"
              onChange={(value) => {
                setCustomer(value);
                setPage(1);
              }}
            />
          </div>
          <button
            className="icon-btn"
            title="Reset filter"
            aria-label="Reset filter"
            onClick={() => {
              setFrom("");
              setTo("");
              setCustomer(null);
              setPage(1);
            }}
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
          <ErrorState error={list.error} retry={() => void list.refetch()} />
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
                {list.data.data.map((order) => (
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
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!invalid && <Pagination meta={list.data?.meta} onChange={setPage} />}
      </section>
    </>
  );
}
