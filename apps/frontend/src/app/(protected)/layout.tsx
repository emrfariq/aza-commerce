import type { ReactNode } from "react";
import Shell from "@/components/shell";
/**
 * Membungkus halaman terlindungi dengan Shell agar memakai navigasi dan pemeriksaan sesi yang
 * sama.
 */
export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return <Shell>{children}</Shell>;
}
