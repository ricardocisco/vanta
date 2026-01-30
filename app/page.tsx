"use client";

import dynamic from "next/dynamic";
import ShadowTerminal from "./ShadowTerminal";

// Mantemos o botão da carteira dinâmico (obrigatório no Next.js + Solana)
const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((mod) => mod.WalletMultiButton),
  { ssr: false }
);

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center p-4 md:p-8 font-sans text-white">
      {/* --- HEADER DO APP (Global) --- */}
      <div className="w-full max-w-5xl flex flex-col md:flex-row justify-between items-center mb-10 border-b border-gray-800/50 pb-6 gap-4">
        {/* Logo / Branding */}
        <div className="text-center md:text-left">
          <h1 className="text-3xl font-bold bg-linear-to-r from-purple-400 to-indigo-500 bg-clip-text text-transparent">
            👻 Vanta Protocol
          </h1>
          <p className="text-xs text-gray-500 mt-1">Privacidade On-Chain • Mainnet Beta</p>
        </div>

        {/* Botão de Conectar (Phantom/Solflare) */}
        <div className="flex items-center gap-4">
          {/* Opcional: Link para Docs ou Twitter aqui */}
          <WalletMultiButton style={{ backgroundColor: "transparent", height: "48px", fontWeight: "bold" }} />
        </div>
      </div>

      {/* --- SHADOW TERMINAL --- */}
      <div className="w-full flex justify-center animate-fade-in-up">
        <ShadowTerminal />
      </div>

      {/* --- FOOTER --- */}
      <div className="mt-16 text-center space-y-2 opacity-60 hover:opacity-100 transition-opacity">
        <p className="text-xs text-gray-500 uppercase font-bold tracking-widest">Hackathon Build</p>
        <div className="flex justify-center gap-4 text-[10px] text-gray-600 font-mono">
          <span>Radr Labs (Privacy)</span>
          <span>•</span>
          <span>Helius (RPC)</span>
          <span>•</span>
          <span>Range (Compliance)</span>
          <span>•</span>
          <span>Encrypt.trade (Edu)</span>
        </div>
      </div>
    </main>
  );
}
