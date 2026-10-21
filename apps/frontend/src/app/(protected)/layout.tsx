import type { ReactNode } from "react";
import Shell from "@/components/shell";
export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return <Shell>{children}</Shell>;
}
