import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "You received a Payment | Vanta Protocol",
  description: "Securely redeem your private transfer. Zero-knowledge compliant payments on Solana.",
  openGraph: {
    title: "You have a pending transfer 👻",
    description: "Click to securely claim your funds via Vanta Protocol."
  }
};

export default function ClaimLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
