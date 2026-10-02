import type { Metadata, Viewport } from "next";
import { Baloo_2, Work_Sans } from "next/font/google";
import "./globals.css";

const baloo = Baloo_2({ variable: "--font-baloo", subsets: ["latin"], display: "swap" });
const work = Work_Sans({ variable: "--font-work", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
};

export const viewport: Viewport = { themeColor: "#12173a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${baloo.variable} ${work.variable}`}>
      <body className="min-h-dvh flex flex-col">{children}</body>
    </html>
  );
}
