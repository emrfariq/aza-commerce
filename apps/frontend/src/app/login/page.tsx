"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Layers3, LoaderCircle, ShoppingBag } from "lucide-react";
import { useAuth } from "@/providers";
import { ErrorMessage, FieldError, Loading } from "@/components/ui";

/**
 * Menampilkan form login dan mengelola status pemrosesan serta pesan error; pengguna yang sudah
 * login diarahkan ke dashboard.
 */
export default function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  /** Mengalihkan pengguna ke dashboard ketika profil sesi sudah tersedia. */
  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);
  /**
   * Membaca email dan password dari form, menjalankan signIn, lalu membuka dashboard; error
   * ditampilkan dan status sibuk selalu dibersihkan.
   */
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const data = new FormData(event.currentTarget);
    try {
      await signIn(String(data.get("email")), String(data.get("password")));
      router.replace("/dashboard");
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-story">
        <div className="brand">
          <span className="brand-mark">
            <ShoppingBag size={24} />
          </span>
          <span>
            aza<span className="brand-light">commerce</span>
          </span>
        </div>
        <div className="login-story-content">
          <span className="login-pill">
            <span className="dot" /> YOUR BUSINESS, IN ORDER
          </span>
          <h1>AZACOMMERCE.</h1>
          <p>
            Produk, pelanggan, dan setiap penjualan.
            <br />
            Semuanya terhubung dalam satu ruang kerja.
          </p>
          <div className="login-feature">
            <Check size={17} /> Stok akurat, transaksi tercatat.
          </div>
          <div className="login-feature">
            <Check size={17} /> Keputusan lebih baik dengan data.
          </div>
        </div>
        <div className="login-story-footer">
          <Layers3 size={20} />
          <span>Operasional sederhana. Bisnis lebih berarti.</span>
        </div>
      </section>
      <section className="login-form-area">
        <div className="login-form-card">
          <span className="section-tag">ADMIN WORKSPACE</span>
          <h2>Selamat datang kembali.</h2>
          <p className="muted">Masuk untuk melanjutkan aktivitas toko Anda.</p>
          {loading || user ? (
            <Loading text="Memeriksa sesi…" />
          ) : (
            <form onSubmit={submit} className="form-stack">
              <ErrorMessage error={error} />
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  required
                  maxLength={150}
                  autoComplete="username"
                  placeholder="nama@perusahaan.com"
                  autoFocus
                />
                <FieldError name="email" error={error} />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  required
                  maxLength={200}
                  autoComplete="current-password"
                  placeholder="Masukkan password Anda"
                />
                <FieldError name="password" error={error} />
              </label>
              <button className="btn login-submit" disabled={busy}>
                {busy ? (
                  <LoaderCircle size={18} className="spin" />
                ) : (
                  <>
                    Masuk ke workspace <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          )}
          <div className="login-note">
            <span className="dot" /> Akses khusus administrator yang terdaftar.
          </div>
        </div>
        <p className="login-copyright">
          © {new Date().getFullYear()} Aza Commerce. All rights reserved.
        </p>
      </section>
    </main>
  );
}
