import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { tournament } from "@/config/tournament";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: tournament.name,
  description: tournament.subtitle,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Telefony nemají vždy 100vh predikovatelně, viewport-fit cover pomáhá
  // notchům na iOS.
  viewportFit: "cover",
  // Brand barva pro browser chrome (Android adresní řádek)
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="cs"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
