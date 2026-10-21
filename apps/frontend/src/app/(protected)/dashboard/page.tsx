"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Package,
  Plus,
  ReceiptText,
  TrendingUp,
} from "lucide-react";
import { api } from "@/lib/api";
import type { Order, Summary } from "@/lib/types";
import { rupiah, tanggal } from "@/lib/format";
import { Empty, ErrorState, Loading, PageTitle } from "@/components/ui";
import { useAuth } from "@/providers";
import DailySalesChart from "@/components/sales-chart";

export default function DashboardPage() {
  const { user } = useAuth();
  const summary = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api<Summary>("/dashboard/summary"),
  });
  const recent = useQuery({
    queryKey: ["orders", "recent"],
    queryFn: () => api<Order[]>("/orders?per_page=5"),
  });
  const data = summary.data?.data;
  return (
    <>
      <PageTitle
        eyebrow="GAMBARAN BISNIS ANDA"
        title={`Halo, ${user?.name.split(" ")[0] ?? "Admin"}.`}
        description="Semua yang Anda butuhkan untuk memulai hari yang produktif."
        action={
          <Link className="btn" href="/orders/new">
            <Plus size={18} />
            Buat order
          </Link>
        }
      />
      {summary.isPending ? (
        <div className="panel">
          <Loading />
        </div>
      ) : summary.isError ? (
        <div className="panel">
          <ErrorState error={summary.error} retry={() => void summary.refetch()} />
        </div>
      ) : (
        data && (
          <>
            <div className="stats-grid">
              <article className="stat-card featured">
                <div className="stat-top">
                  <span>Total penjualan</span>
                  <span className="stat-icon">
                    <Banknote size={21} />
                  </span>
                </div>
                <strong>{rupiah(data.total_sales)}</strong>
                <p>
                  <span className="dot" /> Akumulasi seluruh transaksi
                </p>
              </article>
              <article className="stat-card">
                <div className="stat-top">
                  <span>Total transaksi</span>
                  <span className="stat-icon">
                    <ReceiptText size={21} />
                  </span>
                </div>
                <strong>
                  {data.total_transactions}
                  <small> order</small>
                </strong>
                <p>Penjualan berhasil tercatat</p>
              </article>
              <article className="stat-card">
                <div className="stat-top">
                  <span>Perlu perhatian</span>
                  <span className="stat-icon warning">
                    <Package size={21} />
                  </span>
                </div>
                <strong>
                  {data.low_stock_products.length}
                  <small> produk</small>
                </strong>
                <p>Stok tersisa kurang dari 5</p>
              </article>
            </div>
            <DailySalesChart />
            <div className="dashboard-grid">
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <span className="section-tag">PRODUK PILIHAN PELANGGAN</span>
                    <h2>
                      <TrendingUp size={19} />
                      Produk terlaris
                    </h2>
                  </div>
                  <span className="badge neutral">Top 5</span>
                </div>
                {!data.top_products.length ? (
                  <Empty
                    title="Penjualan pertama menanti"
                    description="Produk terlaris akan tampil setelah order pertama."
                  />
                ) : (
                  <div className="ranking-list">
                    {data.top_products.map((item, index) => (
                      <div className="ranking-row" key={item.product.id}>
                        <span className={`ranking-number ${index === 0 ? "first" : ""}`}>
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <div className="ranking-info">
                          <strong>{item.product.product_name}</strong>
                          <span>
                            {item.product.product_code}
                            {item.product.deleted_at ? " · Diarsipkan" : ""}
                          </span>
                          <div className="rank-track">
                            <span
                              style={{
                                width: `${(item.quantity_sold / (data.top_products[0]?.quantity_sold || 1)) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                        <div className="ranking-qty">
                          <strong>{item.quantity_sold}</strong>
                          <small>terjual</small>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <section className="panel stock-panel">
                <div className="panel-heading">
                  <div>
                    <span className="section-tag">INVENTORI</span>
                    <h2>
                      <AlertTriangle size={18} />
                      Stok menipis
                    </h2>
                  </div>
                  <span className="badge warning">{data.low_stock_products.length} produk</span>
                </div>
                <div className="stock-list">
                  {!data.low_stock_products.length ? (
                    <Empty
                      title="Stok dalam kondisi baik"
                      description="Tidak ada produk dengan stok di bawah 5."
                    />
                  ) : (
                    data.low_stock_products.map((item) => (
                      <div className="stock-row" key={item.id}>
                        <div className="product-mini">
                          <Package size={18} />
                        </div>
                        <div className="grow">
                          <strong>{item.product_name}</strong>
                          <small>{item.product_code}</small>
                        </div>
                        <span className={`stock-count ${item.stock === 0 ? "zero" : ""}`}>
                          {item.stock === 0 ? "Habis" : `${item.stock} unit`}
                        </span>
                      </div>
                    ))
                  )}
                </div>
                <Link href="/products" className="panel-link">
                  Kelola inventori <ArrowUpRight size={16} />
                </Link>
              </section>
            </div>
          </>
        )
      )}
      <section className="panel recent-panel">
        <div className="panel-heading">
          <div>
            <span className="section-tag">AKTIVITAS TERBARU</span>
            <h2>Order terakhir</h2>
          </div>
          <Link href="/orders" className="text-link">
            Semua order <ArrowRight size={16} />
          </Link>
        </div>
        {recent.isPending ? (
          <Loading />
        ) : recent.isError ? (
          <ErrorState error={recent.error} retry={() => void recent.refetch()} />
        ) : !recent.data.data.length ? (
          <Empty
            title="Belum ada order"
            action={
              <Link href="/orders/new" className="btn secondary">
                Catat penjualan pertama
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
                  <th>Tanggal</th>
                  <th className="text-right">Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {recent.data.data.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link className="order-number" href={`/orders/${item.id}`}>
                        {item.order_number}
                      </Link>
                    </td>
                    <td>{item.customer.customer_name}</td>
                    <td className="muted">{tanggal(item.order_date)}</td>
                    <td className="text-right font-semibold">{rupiah(item.total_amount)}</td>
                    <td>
                      <Link
                        className="icon-btn"
                        aria-label={`Detail ${item.order_number}`}
                        href={`/orders/${item.id}`}
                      >
                        <ArrowUpRight size={17} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
