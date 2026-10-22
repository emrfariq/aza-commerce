"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  Boxes,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  ReceiptText,
  ShoppingBag,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/providers";
import { ErrorMessage, ErrorState, Loading } from "./ui";

const links = [
  { href: "/dashboard", label: "Ringkasan", icon: LayoutDashboard },
  { href: "/products", label: "Produk", icon: Boxes },
  { href: "/customers", label: "Pelanggan", icon: Users },
  { href: "/orders", label: "Riwayat order", icon: ReceiptText },
];
/**
 * Menyusun area kerja berisi navigasi, identitas pengguna, dan isi halaman. Menangani
 * pemeriksaan sesi serta pengalihan ke login sebelum menampilkan konten terlindungi.
 */
export default function Shell({ children }: { children: ReactNode }) {
  const { user, loading, error, retry, signOut } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [logoutError, setLogoutError] = useState<unknown>(null);
  const [leaving, setLeaving] = useState(false);
  /**
   * Mengarahkan pengguna tanpa sesi ke login setelah pemeriksaan selesai dan tidak ada error
   * koneksi.
   */
  useEffect(() => {
    if (!loading && !user && !error) router.replace("/login");
  }, [loading, user, error, router]);
  /** Menutup navigasi seluler setiap kali lokasi halaman berubah. */
  useEffect(() => {
    setOpen(false);
  }, [path]);
  if (loading)
    return (
      <main className="full-state">
        <Loading text="Menyiapkan ruang kerja Anda…" />
      </main>
    );
  if (error)
    return (
      <main className="full-state">
        <ErrorState error={new Error(error)} retry={retry} />
      </main>
    );
  if (!user)
    return (
      <main className="full-state">
        <Loading text="Mengarahkan ke halaman login…" />
      </main>
    );
  const activeLabel =
    links.find(
      /*
       * Mencari menu yang alamatnya cocok dengan halaman aktif untuk label navigasi.
       */
      (item) => path.startsWith(item.href),
    )?.label ?? "Order baru";
  /**
   * Menjalankan logout, menampilkan status sibuk, lalu mengarahkan ke login; kegagalan
   * ditampilkan agar pengguna bisa mencoba kembali.
   */
  async function logout() {
    setLeaving(true);
    setLogoutError(null);
    try {
      await signOut();
      router.replace("/login");
    } catch (reason) {
      setLogoutError(reason);
    } finally {
      setLeaving(false);
    }
  }
  return (
    <div className="workspace">
      {open && (
        <button
          className="nav-overlay"
          aria-label="Tutup navigasi"
          onClick={/* Menutup navigasi seluler saat latar penutup diklik. */ () => setOpen(false)}
        />
      )}
      <aside className={`sidebar ${open ? "is-open" : ""}`}>
        <Link href="/dashboard" className="brand">
          <span className="brand-mark">
            <ShoppingBag size={23} />
          </span>
          <span>
            aza<span className="brand-light">commerce</span>
            <small>ORDER MANAGEMENT</small>
          </span>
        </Link>
        <button
          className="icon-btn mobile-close"
          aria-label="Tutup menu"
          onClick={/* Menutup navigasi melalui tombol tutup. */ () => setOpen(false)}
        >
          <X size={20} />
        </button>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Navigasi utama">
          {links.map(
            /* Membentuk tautan menu beserta ikon dan penanda halaman aktif. */ ({
              href,
              label,
              icon: Icon,
            }) => (
              <Link
                key={href}
                href={href}
                className={`nav-link ${path === href || (href === "/orders" && path.startsWith("/orders/") && path !== "/orders/new") ? "active" : ""}`}
              >
                <Icon size={19} />
                <span>{label}</span>
                <ChevronRight size={14} className="nav-chevron" />
              </Link>
            ),
          )}
        </nav>
        <div className="sidebar-callout">
          <span className="callout-icon">
            <Plus size={20} />
          </span>
          <h3>Penjualan berikutnya?</h3>
          <p>Catat transaksi dengan cepat dan biarkan stok terbarui otomatis.</p>
          <Link href="/orders/new">
            Buat order baru <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="sidebar-bottom">
          <div className="avatar">{user.name.charAt(0)}</div>
          <div className="account">
            <strong>{user.name}</strong>
            <small>Administrator</small>
          </div>
          <button
            className="logout"
            title="Keluar"
            aria-label="Keluar"
            onClick={logout}
            disabled={leaving}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div className="flex items-center gap-3">
            <button
              className="icon-btn menu-btn"
              aria-label="Buka menu"
              onClick={/* Membuka navigasi seluler dari tombol menu. */ () => setOpen(true)}
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb">
              Workspace <ChevronRight size={14} />
              <strong>{activeLabel}</strong>
            </span>
          </div>
          <span className="workspace-status">
            <span className="dot" /> Admin workspace
          </span>
        </header>
        <main className="page-content">
          <ErrorMessage error={logoutError} />
          {children}
        </main>
        <footer className="page-footer">
          © {new Date().getFullYear()} Aza Commerce{" "}
          <span>Dibuat untuk operasional yang lebih sederhana.</span>
        </footer>
      </div>
    </div>
  );
}
