import Link from "next/link";
/** Menampilkan halaman 404 dengan tautan kembali ke dashboard saat alamat tidak ditemukan. */
export default function NotFound() {
  return (
    <main className="full-state">
      <div className="state">
        <p className="eyebrow">404</p>
        <h1>Halaman tidak ditemukan</h1>
        <p className="muted">Periksa alamat atau kembali ke ruang kerja.</p>
        <Link className="btn" href="/dashboard">
          Kembali ke dashboard
        </Link>
      </div>
    </main>
  );
}
