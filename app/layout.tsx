import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SolanaProvider } from "../lib/SolanaProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"]
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"]
});

export const metadata: Metadata = {
  title: "Vanta Protocol | Private & Compliant Solana Payments",
  description:
    "Secure, anonymous, and compliant value transfers on Solana. Generate Shadow Links and manage private payrolls with zero-knowledge technology.",
  keywords: ["Solana", "Privacy", "Zero Knowledge", "Payroll", "Crypto", "Compliance", "Shadow Wire", "Blockchain"],
  creator: "Vanta Protocol",
  openGraph: {
    title: "Vanta Protocol | On-Chain Privacy",
    description: "Next-generation privacy infrastructure for Solana payments and payroll.",
    type: "website",
    siteName: "Vanta Protocol",
    locale: "en_US"
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/icons/apple-touch-icon.png"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-vanta-vortex bg-cover bg-center bg-fixed bg-no-repeat bg-background text-foreground`}
      >
        <SolanaProvider>{children}</SolanaProvider>
      </body>
    </html>
  );
}
