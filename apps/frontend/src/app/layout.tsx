import type { Metadata } from "next";
import type { ReactNode } from "react";
import Providers from "@/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Aza Commerce — Order Management", template: "%s | Aza Commerce" },
  description: "Workspace produk, pelanggan, dan penjualan Anda.",
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
