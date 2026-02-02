import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Ghost } from "lucide-react";

export default function Navbar() {
  return (
    <div className="w-full max-w-5xl flex flex-col md:flex-row justify-between items-center mb-10 border-b border-border pb-6 gap-4">
      {/* Logo / Branding */}
      <div className="text-center md:text-left">
        <h1 className="text-3xl font-bold tracking-tight flex items-center justify-center md:justify-start gap-3 text-secondary drop-shadow-[0_0_15px_rgba(157,0,255,0.4)]">
          <Ghost size={32} className="fill-secondary/20" />
          Vanta Protocol
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Privacidade On-Chain • Mainnet</p>
      </div>

      <div className="flex items-center gap-4">
        <WalletMultiButton style={{ backgroundColor: "rgba(0,0,0,0)", height: "48px", fontWeight: "bold" }} />
      </div>
    </div>
  );
}
