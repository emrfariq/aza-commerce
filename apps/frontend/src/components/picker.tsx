"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Search, X } from "lucide-react";
import { api, queryString } from "@/lib/api";
import type { Customer, Product } from "@/lib/types";
import { rupiah } from "@/lib/format";
import { Empty, ErrorState, Loading, Pagination } from "./ui";

type PickerProps<T> = {
  kind: "products" | "customers";
  value: T | null;
  onChange: (value: T | null) => void;
  label: string;
  excluded?: number[];
  disabled?: boolean;
};
/**
 * Mengenali data produk dari keberadaan product_name agar properti khusus produk dapat diakses
 * dengan aman.
 */
const isProduct = (row: Product | Customer): row is Product => "product_name" in row;
/**
 * Menyediakan pemilih produk atau pelanggan dengan pencarian dan pagination. Produk yang
 * dikecualikan atau kehabisan stok tidak bisa dipilih.
 */
export default function Picker<T extends Product | Customer>({
  kind,
  value,
  onChange,
  label,
  excluded = [],
  disabled,
}: PickerProps<T>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const ref = useRef<HTMLDivElement>(null);
  const list = useQuery({
    queryKey: [kind, "picker", page, search],
    enabled: open,
    queryFn:
      /*
       * Memuat lima pilihan per halaman sesuai jenis data dan pencarian ketika dropdown
       * terbuka.
       */
      () => api<T[]>(`/${kind}?${queryString({ page, search, per_page: 5 })}`),
  });
  /** Memasang pendengar klik luar hanya selama dropdown terbuka dan membersihkannya saat ditutup. */
  useEffect(() => {
    if (!open) return;
    /** Menutup dropdown jika target klik berada di luar elemen pemilih. */
    const outside = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", outside);
    return /* Melepas listener klik luar saat effect dibersihkan. */ () =>
      document.removeEventListener("mousedown", outside);
  }, [open]);
  const name = value ? (isProduct(value) ? value.product_name : value.customer_name) : label;
  return (
    <div
      className="picker"
      ref={ref}
      onKeyDown={
        /*
         * Menutup dropdown lewat Escape dan menghentikan event agar tidak ikut menutup
         * elemen induk.
         */
        (event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            setOpen(false);
          }
        }
      }
    >
      <div className="picker-control">
        <button
          type="button"
          className={`picker-toggle ${!value ? "muted" : ""}`}
          disabled={disabled}
          aria-label={label}
          aria-expanded={open}
          onClick={/* Membalik status dropdown antara terbuka dan tertutup. */ () => setOpen(!open)}
        >
          <span>{name}</span>
          <ChevronDown size={16} />
        </button>
        {value && (
          <button
            type="button"
            disabled={disabled}
            className="picker-clear"
            aria-label={`Hapus pilihan ${label}`}
            onClick={
              /*
               * Menghapus pilihan aktif dengan mengirim nilai null kepada komponen induk.
               */
              () => onChange(null)
            }
          >
            <X size={14} />
          </button>
        )}
      </div>
      {open && (
        <div className="picker-menu">
          <div className="search-box">
            <Search size={16} />
            <input
              autoFocus
              aria-label={`Cari ${label}`}
              placeholder="Ketik untuk mencari…"
              value={search}
              onChange={
                /* Mengubah kata pencarian dan kembali ke halaman pertama pilihan. */ (event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }
              }
            />
          </div>
          {list.isPending ? (
            <Loading />
          ) : list.isError ? (
            <ErrorState
              error={list.error}
              retry={
                /* Mencoba memuat ulang daftar pilihan setelah terjadi error. */ () =>
                  void list.refetch()
              }
            />
          ) : !list.data?.data.length ? (
            <Empty
              title="Tidak ditemukan"
              description="Coba kata kunci berbeda atau tambahkan data terlebih dahulu."
            />
          ) : (
            list.data.data.map(
              /*
               * Membentuk tombol pilihan dan menandai produk yang stoknya habis atau sudah
               * dipilih pada baris lain.
               */
              (item) => {
                const product = isProduct(item) ? item : null;
                const unavailable = Boolean(
                  product && (excluded.includes(product.id) || product.stock === 0),
                );
                return (
                  <button
                    type="button"
                    className="picker-option"
                    key={item.id}
                    disabled={unavailable}
                    onClick={
                      /* Meneruskan item yang dipilih kepada induk lalu menutup dropdown. */ () => {
                        onChange(item);
                        setOpen(false);
                      }
                    }
                  >
                    <span>
                      <strong>
                        {"product_name" in item ? item.product_name : item.customer_name}
                      </strong>
                      <small>
                        {product
                          ? `${product.product_code} · Stok ${product.stock}${excluded.includes(product.id) ? " · Sudah dipilih" : ""}`
                          : (item as Customer).customer_address}
                      </small>
                    </span>
                    {product && <span>{rupiah(product.price)}</span>}
                  </button>
                );
              },
            )
          )}
          <Pagination meta={list.data?.meta} onChange={setPage} />
        </div>
      )}
    </div>
  );
}
