"use client";
import { ErrorState } from "@/components/ui";
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
