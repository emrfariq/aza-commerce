"use client";
import { ErrorState } from "@/components/ui";
/**
 * Menampilkan halaman pemulihan saat terjadi error pada rute; tombol coba lagi menjalankan reset
 * dari Next.js.
 */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="full-state">
      <ErrorState
        error={new Error("Halaman mengalami kendala. Silakan muat kembali.")}
        retry={reset}
      />
    </main>
  );
}
