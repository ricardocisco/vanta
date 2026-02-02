"use client";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useWallet } from "@solana/wallet-adapter-react";
import { ShadowWireClient, initWASM, isWASMSupported, SUPPORTED_TOKENS as SDK_TOKENS } from "@radr/shadowwire";
import { SUPPORTED_TOKENS, TokenOption } from "@/lib/tokens";
import { RotateCw, Send, Link, Shield, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import WalletManager from "@/components/WalletManager";
import PrivatePayroll from "@/components/PrivatePayroll";
import ShadowLinkCreator from "@/components/ShadowLinkCreator";
import { SystemStatus } from "@/components/SystemStatus";
import LinkHistory from "@/components/LinkStorage";

// SDK Token Type
type SdkTokenType = (typeof SDK_TOKENS)[number];

// Custom Token Selector Component
function TokenSelector({
  selectedToken,
  onSelect
}: {
  selectedToken: TokenOption;
  onSelect: (token: TokenOption) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Selected Token Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-black/20 border border-secondary/30 px-3 py-2 rounded-md text-foreground font-bold cursor-pointer hover:border-primary/80 focus:outline-none focus:border-primary focus:shadow-[0_0_10px_rgba(0,255,65,0.2)] transition-all duration-200 min-w-30 h-9 text-sm"
      >
        <Image src={selectedToken.icon} width={20} height={20} alt={selectedToken.symbol} className="rounded-full" />
        <span className="flex-1 text-left">{selectedToken.symbol}</span>
        <ChevronDown size={16} className={`text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 min-w-40 bg-popover border border-border rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="max-h-60 overflow-y-auto overflow-x-hidden custom-scrollbar">
            {SUPPORTED_TOKENS.map((token) => (
              <button
                key={token.symbol}
                onClick={() => {
                  onSelect(token);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors relative overflow-hidden group ${
                  selectedToken.symbol === token.symbol ? "bg-muted" : ""
                }`}
              >
                {/* Glow effect for recommended */}
                {token.recommended && (
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-yellow-400 shadow-[0_0_10px_#fbbf24] z-10" />
                )}

                <Image src={token.icon} width={24} height={24} alt={token.symbol} className="rounded-full shrink-0" />
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-foreground font-bold text-sm tracking-wide">{token.symbol}</p>
                    {token.recommended && (
                      <span className="text-[8px] bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 px-1.5 rounded uppercase font-bold tracking-wider">
                        Best
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground text-[10px] truncate">{token.name}</p>
                </div>
                {selectedToken.symbol === token.symbol && <div className="w-2 h-2 bg-primary rounded-full shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

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
      console.log(`[Global] Fetching ${selectedToken.symbol} balance...`);

      const raw = await client.getBalance(publicKey.toBase58(), selectedToken.symbol as SdkTokenType);
      const available = raw.available || 0;
      const bal = Number(available) / Math.pow(10, selectedToken.decimals);

      setPrivateBalance(bal);
    } catch (e) {
      console.error("Error fetching global balance:", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBalance();
  }, [publicKey, selectedToken, isWasmReady]);

  if (!isWasmReady)
    return <div className="text-center p-10 text-primary animate-pulse">Initializing ZK Circuits...</div>;

  return (
    <Card className="w-full max-w-5xl mx-auto rounded-3xl overflow-hidden shadow-2xl border-border bg-card animate-neon-pulse transition-shadow duration-500">
      {/* HEADER GLOBAL */}
      <div className="p-6 border-b border-border bg-muted/20 flex flex-col md:flex-row justify-between items-center gap-4">
        {/* Global Token Selector */}
        <div className="flex items-center gap-4 w-full md:w-auto">
          <TokenSelector selectedToken={selectedToken} onSelect={setSelectedToken} />
        </div>

        {/* Global Balance Display */}
        <div className="flex items-center gap-3 bg-background/40 px-4 py-2 rounded-xl border border-border">
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground uppercase font-bold">Private Balance</p>
            <p className="text-xl font-mono font-bold text-foreground leading-none">{privateBalance.toFixed(4)}</p>
          </div>
          <Button disabled={isRefreshing} variant="ghost" size="icon" onClick={fetchBalance} className="group text-xs">
            <span className="group-disabled:animate-spin">
              <RotateCw size={14} />
            </span>
          </Button>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex border-b border-border bg-muted/10">
        <TabButton
          active={activeTab === "wallet"}
          onClick={() => setActiveTab("wallet")}
          label="Wallet"
          icon={Shield}
        />
        <TabButton
          active={activeTab === "transfer"}
          onClick={() => setActiveTab("transfer")}
          label="Transfer"
          icon={Send}
        />
        <TabButton active={activeTab === "link"} onClick={() => setActiveTab("link")} label="Vanta Link" icon={Link} />
      </div>

      {/* CONTENT */}
      <div className="p-6 min-h-100">
        {activeTab === "wallet" && (
          <WalletManager selectedToken={selectedToken} privateBalance={privateBalance} onUpdateBalance={fetchBalance} />
        )}

        {activeTab === "transfer" && (
          <PrivatePayroll selectedToken={selectedToken} privateBalance={privateBalance} onSuccess={fetchBalance} />
        )}

        {activeTab === "link" && (
          <div className="animate-fade-in">
            <ShadowLinkCreator globalToken={selectedToken} globalBalance={privateBalance} onSuccess={fetchBalance} />

            <LinkHistory />
          </div>
        )}
      </div>

      {/* --- FOOTER (STATUS) --- */}
      <div className="bg-background p-4 border-t border-border">
        <SystemStatus />
      </div>
    </Card>
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
    className={`flex-1 py-4 text-sm font-bold transition-all border-b-2 flex items-center justify-center gap-2 relative overflow-hidden ${
      active
        ? "border-primary text-primary bg-primary/10 shadow-[inner_0_0_20px_rgba(0,255,65,0.1)]"
        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
    }`}
  >
    {active && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary shadow-[0_0_10px_var(--primary)]" />}
    {Icon && <Icon size={16} className={active ? "drop-shadow-[0_0_5px_var(--primary)]" : ""} />}
    {label}
  </button>
);
