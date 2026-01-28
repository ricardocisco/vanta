"use client";

import dynamic from "next/dynamic";
import PrivatePayroll from "../components/PrivatePayroll";
import ShadowLinkCreator from "../components/ShadowLinkCreator";

// O botão da carteira precisa ser importado com SSR: false para evitar erros de hidratação no Next.js
const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (mod) => mod.WalletMultiButton
    ),
  { ssr: false }
);

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-black text-white">
      {/* Header com o Botão de Conectar */}
      <div className="w-full max-w-5xl flex justify-between items-center mb-12 border-b border-gray-800 pb-4">
        <h1 className="text-2xl font-bold bg-linear-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent">
          👻 Shadow Payroll
        </h1>

        {/* ESTE É O BOTÃO QUE FALTAVA */}
        <div className="bg-purple-900 rounded-lg">
          <WalletMultiButton style={{ backgroundColor: "#4c1d95" }} />
        </div>
      </div>

      {/* Seu Componente de Pagamento (Só funciona se o botão acima estiver conectado) */}
      <div className="w-full">
        <PrivatePayroll />
      </div>

      <div className="mt-10 text-gray-500 text-sm">
        Powered by Radr Labs • Helius • Range
      </div>
      <div>
        <ShadowLinkCreator />
      </div>
    </main>
  );
}
