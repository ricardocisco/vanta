"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { ArrowDown, ChevronDown, RotateCw } from "lucide-react";
import { TokenOption, SUPPORTED_TOKENS } from "@/lib/tokens";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SwapManagerProps {
  selectedToken: TokenOption; // Token "FROM" (Global)
  privateBalance: number;
  onSuccess: () => void;
}

// Reusable Token Selector for the "To" field (or internal use)
function SwapTokenSelector({ selected, onSelect }: { selected: TokenOption; onSelect: (t: TokenOption) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-black/40 border border-border/50 hover:border-primary/50 px-3 py-1.5 rounded-full transition-all min-w-35"
      >
        <Image src={selected.icon} alt={selected.symbol} width={20} height={20} className="rounded-full" />
        <span className="flex-1 text-left font-bold text-sm">{selected.symbol}</span>
        <ChevronDown size={14} className={`text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-48 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            {SUPPORTED_TOKENS.map((token) => (
              <button
                key={token.symbol}
                onClick={() => {
                  onSelect(token);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors ${
                  selected.symbol === token.symbol ? "bg-muted/30" : ""
                }`}
              >
                <Image src={token.icon} width={20} height={20} alt={token.symbol} className="rounded-full" />
                <span className="text-sm font-bold">{token.symbol}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SwapManager({ selectedToken, privateBalance, onSuccess }: SwapManagerProps) {
  // State
  const [targetToken, setTargetToken] = useState<TokenOption>(
    SUPPORTED_TOKENS.find((t) => t.symbol === "USDC") || SUPPORTED_TOKENS[1]
  );
  const [amountFrom, setAmountFrom] = useState("");
  const [amountTo, setAmountTo] = useState("");
  const [loading, setLoading] = useState(false);

  // Mock exchange rate (1 TOKEN = X TARGET)
  const exchangeRate = 1.5; // Example: 1 SOL = 150 USDC (fake)

  // Auto-calculate logic
  useEffect(() => {
    const val = parseFloat(amountFrom);
    if (!isNaN(val)) {
      setAmountTo((val * exchangeRate).toFixed(4));
    } else {
      setAmountTo("");
    }
  }, [amountFrom]);

  const handleSwap = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onSuccess();
    }, 2000);
  };

  const handleSwitch = () => {
    // In a real scenario, this would involve notifying the parent to change the global 'selectedToken'
    // For now, we just visually swap localized state logic or allow user to see interaction
    const temp = amountFrom;
    setAmountFrom(amountTo);
    // Logic to switch tokens would require parent callback if 'From' is fixed global
  };

  return (
    <div className="max-w-md mx-auto relative space-y-2 animate-fade-in p-2">
      {/* 1. FROM CARD (Top) */}
      <div className="bg-card border border-border/40 rounded-3xl p-6 relative z-10 transition-colors shadow-lg">
        <div className="flex justify-between mb-4">
          <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Sell / From</span>
          <span className="text-xs text-muted-foreground/80 font-mono">
            Balance: {privateBalance.toFixed(4)} {selectedToken.symbol}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <Input
            type="number"
            placeholder="0.0"
            value={amountFrom}
            onChange={(e) => setAmountFrom(e.target.value)}
            className="flex-1 bg-transparent text-4xl font-bold border-none p-0 h-auto placeholder:text-muted-foreground/20 shadow-none font-mono text-foreground focus:bg-transparent hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-none focus-visible:shadow-none focus:outline-none outline-none transition-none"
          />

          {/* Read-Only Badge for Global Token (From) */}
          <div className="flex items-center gap-2 bg-black/40 border border-border/30 px-3 py-2 rounded-full min-w-35 opacity-80 cursor-not-allowed">
            <Image
              src={selectedToken.icon}
              alt={selectedToken.symbol}
              width={24}
              height={24}
              className="rounded-full"
            />
            <span className="text-base font-bold ml-1">{selectedToken.symbol}</span>
          </div>
        </div>

        <div className="text-sm text-muted-foreground mt-2 font-medium">≈ ${(Number(amountFrom) * 150).toFixed(2)}</div>
      </div>

      {/* CENTER SWITCH BUTTON */}
      <div className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 z-20">
        <div className="bg-[#000000] p-1.5 rounded-xl">
          <button
            onClick={handleSwitch}
            className="bg-card border border-border/40 rounded-lg p-2 hover:bg-muted/50 transition-colors group"
          >
            <ArrowDown size={16} className="group-hover:text-primary transition-colors" />
          </button>
        </div>
      </div>

      {/* 2. TO CARD (Bottom) */}
      <div className="bg-card border border-border/40 rounded-3xl p-6 pt-6 relative z-0 mt-2 shadow-lg">
        <div className="flex justify-between mb-4">
          <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Buy / Receive</span>
        </div>

        <div className="flex items-center justify-between gap-4">
          {/* Read-only output */}
          <div className="flex-1 font-mono text-4xl font-bold text-foreground/80 truncate h-12 flex items-center">
            {amountTo || "0.0"}
          </div>

          {/* Select Target Token */}
          <SwapTokenSelector selected={targetToken} onSelect={setTargetToken} />
        </div>

        <div className="text-sm text-muted-foreground mt-2 flex justify-between font-medium">
          <span>≈ ${(Number(amountTo) * 1).toFixed(2)}</span>
          <span className="text-[10px] bg-green-500/10 border border-green-500/20 text-green-500 px-2 py-0.5 rounded-full font-bold">
            Rate: 1 {selectedToken.symbol} ≈ {exchangeRate} {targetToken.symbol}
          </span>
        </div>
      </div>

      {/* Action Button */}
      <Button
        onClick={handleSwap}
        disabled={loading || !amountFrom || Number(amountFrom) <= 0}
        className="w-full py-6 mt-4 text-lg font-bold shadow-[0_0_20px_hsl(135,100%,50%,0.2)] hover:shadow-[0_0_30px_hsl(135,100%,50%,0.4)]"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <RotateCw className="animate-spin" /> Swapping...
          </span>
        ) : (
          "Swap Tokens"
        )}
      </Button>
    </div>
  );
}
