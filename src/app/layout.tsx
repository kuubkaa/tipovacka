import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NavigationProgress } from "@/components/navigation-progress";
import { PaymentDueDialog } from "@/components/payment-due-dialog";
import { auth } from "@/auth";
import { tournament, isDeadlinePassed } from "@/config/tournament";
import { db } from "@/lib/db";

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
  // Vypne iOS/Safari automatické „data detectors" (telefon, datum, adresa…),
  // které umí text auto-obarvit / udělat z něj odkaz.
  formatDetection: { telephone: false, date: false, address: false, email: false },
};

// Layout čte přihlášení (cookie) kvůli upozornění na nezaplacené startovné,
// takže každá stránka se musí vykreslit per-request (žádný statický cache).
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Telefony nemají vždy 100vh predikovatelně, viewport-fit cover pomáhá
  // notchům na iOS.
  viewportFit: "cover",
  // Brand barva pro browser chrome (Android adresní řádek)
  themeColor: "#0f172a",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Po deadlinu připomeň nezaplaceným tipérům platbu startovného.
  let showPaymentDue = false;
  if (isDeadlinePassed()) {
    const session = await auth();
    if (session?.user?.id) {
      const u = await db.user.findUnique({
        where: { id: session.user.id },
        select: { paid: true },
      });
      if (u && !u.paid) showPaymentDue = true;
    }
  }

  return (
    <html
      lang="cs"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NavigationProgress />
        {children}
        {showPaymentDue && (
          <PaymentDueDialog qrUrl={tournament.paymentQrUrl} />
        )}
      </body>
    </html>
  );
}
