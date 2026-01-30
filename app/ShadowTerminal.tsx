"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { useWallet } from "@solana/wallet-adapter-react";
import { ShadowWireClient, initWASM, isWASMSupported } from "@radr/shadowwire";
import { SUPPORTED_TOKENS, TokenOption } from "@/lib/tokens";
import { RotateCw, Wallet, Send, Link } from "lucide-react";
import { Button } from "@/components/ui/button";
import WalletManager from "@/components/WalletManager";
import PrivatePayroll from "@/components/PrivatePayroll";
import ShadowLinkCreator from "@/components/ShadowLinkCreator";
import { SystemStatus } from "@/components/SystemStatus";
import LinkHistory from "@/components/LinkStorage";

export default function ShadowTerminal() {
  const { publicKey } = useWallet();

  // GLOBAL STATE
  const [activeTab, setActiveTab] = useState<"wallet" | "transfer" | "link">("wallet");
  const [selectedToken, setSelectedToken] = useState<TokenOption>(SUPPORTED_TOKENS[0]);
  const [privateBalance, setPrivateBalance] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isWasmReady, setIsWasmReady] = useState(false);

  // Init WASM
  useEffect(() => {
    const init = async () => {
      if (isWASMSupported()) {
        await initWASM("/wasm/settler_wasm_bg.wasm");
        setIsWasmReady(true);
      }
    };
    init();
  }, []);

  // Fetch Balance (Global)
  const fetchBalance = async () => {
    if (!publicKey || !isWasmReady) return;
    setIsRefreshing(true);
    try {
      const client = new ShadowWireClient();
      console.log(`[Global] Buscando saldo de ${selectedToken.symbol}...`);

      const raw = await client.getBalance(publicKey.toBase58(), selectedToken.symbol);
      const available = raw.available || 0;
      const bal = Number(available) / Math.pow(10, selectedToken.decimals);

      setPrivateBalance(bal);
    } catch (e) {
      console.error("Erro ao buscar saldo global:", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Atualiza saldo quando muda token ou conecta
  useEffect(() => {
    fetchBalance();
  }, [publicKey, selectedToken, isWasmReady]);

  if (!isWasmReady)
    return <div className="text-center p-10 text-purple-400 animate-pulse">Iniciando ZK Circuits...</div>;

  return (
    <div className="w-full max-w-3xl mx-auto bg-[#0a0a0a] border border-gray-800 rounded-3xl overflow-hidden shadow-2xl">
      {/* HEADER GLOBAL */}
      <div className="p-6 border-b border-gray-800 bg-gray-900/50 flex flex-col md:flex-row justify-between items-center gap-4">
        {/* Seletor de Token Global */}
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative group">
            <select
              value={selectedToken.symbol}
              onChange={(e) => {
                const t = SUPPORTED_TOKENS.find((x) => x.symbol === e.target.value);
                if (t) setSelectedToken(t);
              }}
              className="appearance-none bg-black border border-gray-700 pl-10 pr-8 py-2 rounded-lg text-white font-bold cursor-pointer hover:border-purple-500 focus:outline-none"
            >
              {SUPPORTED_TOKENS.map((t) => (
                <option key={t.symbol} value={t.symbol}>
                  {t.symbol}
                </option>
              ))}
            </select>
            <div className="absolute left-3 top-2.5 pointer-events-none">
              <Image src={selectedToken.icon} width={20} height={20} alt="icon" className="rounded-full" />
            </div>
          </div>
        </div>

        {/* Display de Saldo Global */}
        <div className="flex items-center gap-3 bg-black/40 px-4 py-2 rounded-xl border border-gray-800">
          <div className="text-right">
            <p className="text-[10px] text-gray-500 uppercase font-bold">Saldo Privado</p>
            <p className="text-xl font-mono font-bold text-white leading-none">{privateBalance.toFixed(4)}</p>
          </div>
          <Button
            disabled={isRefreshing}
            size="icon-sm"
            onClick={fetchBalance}
            className="group text-xs bg-gray-800 hover:bg-gray-700 "
          >
            <span className="group-disabled:animate-spin">
              <RotateCw size={14} />
            </span>
          </Button>
        </div>
      </div>

      {/* TABS DE NAVEGAÇÃO */}
      <div className="flex border-b border-gray-800 bg-black/20">
        <TabButton
          active={activeTab === "wallet"}
          onClick={() => setActiveTab("wallet")}
          label="Carteira"
          icon={Wallet}
        />
        <TabButton
          active={activeTab === "transfer"}
          onClick={() => setActiveTab("transfer")}
          label="Transferir"
          icon={Send}
        />
        <TabButton active={activeTab === "link"} onClick={() => setActiveTab("link")} label="Vanta Link" icon={Link} />
      </div>

      {/* CONTEÚDO */}
      <div className="p-6 min-h-100">
        {activeTab === "wallet" && (
          <WalletManager selectedToken={selectedToken} privateBalance={privateBalance} onUpdateBalance={fetchBalance} />
        )}

        {activeTab === "transfer" && (
          <PrivatePayroll selectedToken={selectedToken} privateBalance={privateBalance} onSuccess={fetchBalance} />
        )}

        {activeTab === "link" && (
          <div className="animate-fade-in">
            <ShadowLinkCreator
              globalToken={selectedToken}
              globalBalance={privateBalance} // <--- Passando o saldo global (opcional)
              onSuccess={fetchBalance} // <--- Para atualizar saldo após criar
            />

            <LinkHistory />
          </div>
        )}
      </div>

      {/* --- FOOTER (STATUS) --- */}
      <div className="bg-[#050505] p-4 border-t border-gray-800">
        <SystemStatus />
      </div>
    </div>
  );
}

const TabButton = ({
  active,
  onClick,
  label,
  icon: Icon
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ElementType;
}) => (
  <button
    onClick={onClick}
    className={`flex-1 py-4 text-sm font-bold transition-all border-b-2 flex items-center justify-center gap-2 ${
      active ? "border-purple-500 text-white bg-white/5" : "border-transparent text-gray-500 hover:text-gray-300"
    }`}
  >
    {Icon && <Icon size={16} />}
    {label}
  </button>
);
