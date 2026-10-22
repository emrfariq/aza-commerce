"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, LoaderCircle, PackageOpen, X } from "lucide-react";
import type { Meta } from "@/lib/types";
import { ApiError } from "@/lib/api";

/**
 * Menampilkan judul, keterangan, dan aksi opsional dengan susunan header yang konsisten
 * antarhalaman.
 */
export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {action}
    </header>
  );
}
/** Menampilkan indikator pemuatan dengan role status agar proses juga dikenali pembaca layar. */
export function Loading({ text = "Memuat data…" }: { text?: string }) {
  return (
    <div className="state" role="status">
      <LoaderCircle className="spin" size={25} />
      <p>{text}</p>
    </div>
  );
}
/** Menampilkan keadaan data kosong beserta penjelasan dan tombol aksi opsional. */
export function Empty({
  title = "Belum ada data",
  description = "Data akan tampil di sini setelah ditambahkan.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="state">
      <div className="state-icon">
        <PackageOpen size={27} />
      </div>
      <h3>{title}</h3>
      <p className="muted">{description}</p>
      {action}
    </div>
  );
}
/** Menampilkan pesan gagal memuat data dan tombol mencoba ulang jika callback retry tersedia. */
export function ErrorState({ error, retry }: { error: Error; retry?: () => void }) {
  return (
    <div className="state" role="alert">
      <AlertCircle size={25} />
      <h3>Data belum dapat dimuat</h3>
      <p className="muted">{error.message}</p>
      {retry && (
        <button className="btn secondary" onClick={retry}>
          Coba lagi
        </button>
      )}
    </div>
  );
}
/** Menampilkan pemberitahuan error bila ada; nilai yang bukan objek Error memakai pesan umum. */
export function ErrorMessage({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div className="notice danger" role="alert">
      <AlertCircle size={18} />
      <span>{error instanceof Error ? error.message : "Terjadi kesalahan"}</span>
    </div>
  );
}
/**
 * Mengambil pesan validasi dari ApiError berdasarkan nama field agar error tampil di dekat input
 * terkait.
 */
export function FieldError({ name, error }: { name: string; error: unknown }) {
  const messages = error instanceof ApiError ? error.fields[name] : undefined;
  return messages?.length ? (
    <small className="field-error" role="alert">
      {messages.join(". ")}
    </small>
  ) : null;
}
/**
 * Menampilkan rentang data dan navigasi pagination dari metadata server serta menonaktifkan
 * tombol di batas halaman.
 */
export function Pagination({ meta, onChange }: { meta?: Meta; onChange: (page: number) => void }) {
  if (!meta) return null;
  return (
    <div className="pagination">
      <span className="muted">
        {meta.total === 0
          ? "0 data"
          : `${(meta.page - 1) * meta.per_page + 1}–${Math.min(meta.page * meta.per_page, meta.total)} dari ${meta.total} data`}
      </span>
      <div className="flex items-center gap-3">
        <button
          className="icon-btn"
          aria-label="Halaman sebelumnya"
          disabled={meta.page <= 1}
          onClick={
            /* Meminta komponen induk berpindah ke halaman sebelumnya. */ () =>
              onChange(meta.page - 1)
          }
        >
          <ArrowLeft size={17} />
        </button>
        <span>
          {meta.page} / {Math.max(1, meta.total_pages)}
        </span>
        <button
          className="icon-btn"
          aria-label="Halaman berikutnya"
          disabled={meta.page >= meta.total_pages}
          onClick={
            /* Meminta komponen induk berpindah ke halaman berikutnya. */ () =>
              onChange(meta.page + 1)
          }
        >
          <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
}
/** Menampilkan jumlah stok dan memberi warna peringatan jika jumlahnya kurang dari lima. */
export function StockBadge({ stock }: { stock: number }) {
  return (
    <span className={`badge ${stock < 5 ? "warning" : "success"}`}>
      <span className="dot" />
      {stock} tersedia
    </span>
  );
}

/**
 * Menampilkan modal dengan elemen dialog bawaan browser untuk pengelolaan fokus. Penutupan
 * melalui Escape atau klik latar diblokir saat busy agar proses simpan tidak terganggu.
 */
export function Modal({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  /** Membuka dialog setelah elemen terpasang dan menyiapkan penutupan ketika komponen dilepas. */
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return /* Menutup dialog saat effect dibersihkan. */ () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={
        /*
         * Mencegah penutupan bawaan lewat Escape dan meneruskan penutupan ke induk hanya
         * saat tidak sibuk.
         */
        (event) => {
          event.preventDefault();
          if (!busy) onClose();
        }
      }
      onClick={
        /*
         * Menutup modal hanya saat klik mengenai latar dialog dan tidak ada proses yang
         * sedang berjalan.
         */
        (event) => {
          if (event.target === event.currentTarget && !busy) onClose();
        }
      }
    >
      <div className="modal-heading">
        <h2 id="modal-title">{title}</h2>
        <button
          type="button"
          className="icon-btn"
          aria-label="Tutup dialog"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
