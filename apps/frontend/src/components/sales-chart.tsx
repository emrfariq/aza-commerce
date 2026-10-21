"use client";

import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import type { DailySales, DailySalesPoint } from "@/lib/types";
import { rupiah, tanggal } from "@/lib/format";
import { Empty, ErrorState, Loading } from "./ui";

const shortDate = (date: string) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(`${date}T00:00:00+07:00`));
const compactRupiah = (value: number) =>
  `Rp ${new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(value)}`;

function SalesTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: readonly { payload?: DailySalesPoint }[];
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="sales-tooltip" role="status" aria-live="polite">
      <p>{tanggal(`${point.date}T00:00:00+07:00`)}</p>
      <strong>{rupiah(point.total_sales)}</strong>
      <small>{point.total_transactions} transaksi</small>
    </div>
  );
}

export default function DailySalesChart() {
  const [days, setDays] = useState(30);
  const gradientId = `sales-${useId().replaceAll(":", "")}`;
  const query = useQuery({
    queryKey: ["dashboard", "daily-sales", days],
    queryFn: () => api<DailySales>(`/dashboard/daily-sales?days=${days}`),
  });
  const data = query.data?.data;
  // Numbers are for SVG coordinates only; totals and tooltip values come from server decimals.
  const points =
    data?.series.map((point) => ({ ...point, amount: Number(point.total_sales) })) ?? [];
  return (
    <section className="panel sales-chart-section" aria-label="Grafik penjualan harian">
      <div className="panel-heading sales-chart-heading">
        <div>
          <span className="section-tag">PERFORMA PENJUALAN</span>
          <h2>
            <TrendingUp size={19} />
            Grafik penjualan harian
          </h2>
        </div>
        <div className="range-selector" role="group" aria-label="Periode grafik penjualan">
          {[7, 30, 90].map((period) => (
            <button
              key={period}
              className="range-button"
              aria-pressed={days === period}
              onClick={() => setDays(period)}
            >
              {period} hari
            </button>
          ))}
        </div>
      </div>
      {query.isPending ? (
        <div className="sales-chart-state">
          <Loading text="Memuat penjualan harian…" />
        </div>
      ) : query.isError ? (
        <div className="sales-chart-state">
          <ErrorState error={query.error} retry={() => void query.refetch()} />
        </div>
      ) : (
        data && (
          <>
            <div className="sales-chart-totals">
              <div>
                <span className="muted">Penjualan periode ini</span>
                <strong>{rupiah(data.total_sales)}</strong>
              </div>
              <div className="sales-chart-count">
                <strong>{data.total_transactions}</strong>
                <span className="muted">transaksi</span>
              </div>
            </div>
            <p className="sales-chart-period">
              {shortDate(data.from)} – {tanggal(`${data.to}T00:00:00+07:00`)} · {days} hari terakhir
            </p>
            {!data.total_transactions ? (
              <Empty
                title="Belum ada penjualan pada periode ini"
                description="Pilih periode lain atau buat order untuk mulai melihat grafik penjualan."
              />
            ) : (
              <div className="sales-chart-canvas">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <AreaChart
                    data={points}
                    margin={{ top: 12, right: 16, left: 8, bottom: 10 }}
                    accessibilityLayer
                  >
                    <defs>
                      <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--line)" strokeDasharray="3 4" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={shortDate}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={28}
                      tickMargin={10}
                      tick={{ fill: "var(--muted)", fontSize: 10 }}
                    />
                    <YAxis
                      tickFormatter={compactRupiah}
                      axisLine={false}
                      tickLine={false}
                      width={75}
                      tick={{ fill: "var(--muted)", fontSize: 10 }}
                      domain={[0, "auto"]}
                    />
                    <Tooltip
                      content={<SalesTooltip />}
                      cursor={{ stroke: "var(--primary)", strokeDasharray: "4 4" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      name="Penjualan"
                      stroke="var(--primary)"
                      strokeWidth={2.5}
                      fill={`url(#${gradientId})`}
                      isAnimationActive={false}
                      activeDot={{
                        r: 5,
                        fill: "var(--primary)",
                        stroke: "var(--surface)",
                        strokeWidth: 2,
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
            <p className="sales-chart-caption">
              Per hari kalender Asia/Jakarta (WIB). Hari tanpa transaksi bernilai Rp 0.
            </p>
            <details className="sales-data">
              <summary>Lihat data harian</summary>
              <div className="table-scroll">
                <table>
                  <caption className="sr-only">
                    Data penjualan harian pada periode yang dipilih
                  </caption>
                  <thead>
                    <tr>
                      <th>Tanggal (WIB)</th>
                      <th className="text-right">Transaksi</th>
                      <th className="text-right">Penjualan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.series.map((point) => (
                      <tr key={point.date}>
                        <td>{tanggal(`${point.date}T00:00:00+07:00`)}</td>
                        <td className="text-right">{point.total_transactions}</td>
                        <td className="text-right">{rupiah(point.total_sales)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )
      )}
    </section>
  );
}
