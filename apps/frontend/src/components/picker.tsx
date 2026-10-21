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
const isProduct = (row: Product | Customer): row is Product => "product_name" in row;
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
    queryFn: () => api<T[]>(`/${kind}?${queryString({ page, search, per_page: 5 })}`),
  });
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [open]);
  const name = value ? (isProduct(value) ? value.product_name : value.customer_name) : label;
  return (
    <div
      className="picker"
      ref={ref}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <div className="picker-control">
        <button
          type="button"
          className={`picker-toggle ${!value ? "muted" : ""}`}
          disabled={disabled}
          aria-label={label}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
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
            onClick={() => onChange(null)}
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
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          {list.isPending ? (
            <Loading />
          ) : list.isError ? (
            <ErrorState error={list.error} retry={() => void list.refetch()} />
          ) : !list.data?.data.length ? (
            <Empty
              title="Tidak ditemukan"
              description="Coba kata kunci berbeda atau tambahkan data terlebih dahulu."
            />
          ) : (
            list.data.data.map((item) => {
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
                  onClick={() => {
                    onChange(item);
                    setOpen(false);
                  }}
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
            })
          )}
          <Pagination meta={list.data?.meta} onChange={setPage} />
        </div>
      )}
    </div>
  );
}
