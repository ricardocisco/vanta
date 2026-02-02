/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Keypair, Transaction, SystemProgram } from "@solana/web3.js";
import bs58 from "bs58";
import { ShadowWireClient, SUPPORTED_TOKENS as SDK_TOKENS } from "@radr/shadowwire";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ProcessStatus, ProcessStep, StepStatus } from "@/components/ProcessStatus";
import { TokenOption } from "@/lib/tokens";
import { calculateLinkGasFee, getTokenMinimumAmount, getTokenFeePercentage } from "@/lib/fees";
import { AlertCircle, CheckCircle, Copy, Gift, Info, ShieldCheck, Key, Lock, Send } from "lucide-react";

// SDK Token Type
type SdkTokenType = (typeof SDK_TOKENS)[number];

interface ShadowLinkCreatorProps {
  globalToken: TokenOption;
  globalBalance: number;
  onSuccess?: () => void;
}

// Helper function to save to permanent history
const saveLinkToHistory = (linkData: any) => {
  const history = JSON.parse(localStorage.getItem("vanta_link_history") || "[]");
  const newEntry = {
    id: Date.now(),
    createdAt: new Date().toISOString(),
    ...linkData
  };
  history.unshift(newEntry);
  localStorage.setItem("vanta_link_history", JSON.stringify(history));
  return newEntry.id;
};

// Updates link status in history
const updateLinkInHistory = (linkId: number, updates: any) => {
  const history = JSON.parse(localStorage.getItem("vanta_link_history") || "[]");
  const updated = history.map((link: any) => (link.id === linkId ? { ...link, ...updates } : link));
  localStorage.setItem("vanta_link_history", JSON.stringify(updated));
};

// Remove link from history (if no transfer was completed)
const removeLinkFromHistory = (linkId: number) => {
  const history = JSON.parse(localStorage.getItem("vanta_link_history") || "[]");
  const filtered = history.filter((link: any) => link.id !== linkId);
  localStorage.setItem("vanta_link_history", JSON.stringify(filtered));
};

export default function ShadowLinkCreator({ globalToken, globalBalance, onSuccess }: ShadowLinkCreatorProps) {
  const { publicKey, signMessage, sendTransaction } = useWallet();
  const { connection } = useConnection();

  // UI States
  const [view, setView] = useState<"input" | "processing" | "success">("input");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [amount, setAmount] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");
  const [gasFee, setGasFee] = useState<number>(0.003); // Default, will be updated

  // Calculate gas fee dynamically on mount
  useEffect(() => {
    const loadGasFee = async () => {
      const fee = await calculateLinkGasFee(connection);
      setGasFee(fee);
      console.log("[Link] Dynamic gas fee calculated:", fee, "SOL");
    };
    loadGasFee();
  }, [connection]);

  // Clear error when typing
  useEffect(() => {
    if (error) setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount]);

  // Step Control
  const [steps, setSteps] = useState<ProcessStep[]>([
    { id: "compliance", label: "Range Verification", status: "pending", icon: ShieldCheck },
    { id: "keygen", label: "Generating Keys", status: "pending", icon: Key },
    { id: "zkproof", label: "Radr Privacy Proof", status: "pending", icon: Lock },
    { id: "transfer", label: "Transfer to Link", status: "pending", icon: Send }
  ]);

  const updateStep = (id: string, status: StepStatus, detail?: string) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, status, detail } : s)));
  };

  // --- CREATION LOGIC ---
  const handleCreateLink = async () => {
    if (!publicKey || !signMessage) return setError("Connect your wallet.");

    const numAmount = Number(amount);

    // --- VALIDATION 1: RADR MINIMUM (dynamic from SDK) ---
    const minAmount = getTokenMinimumAmount(globalToken.symbol);
    if (numAmount < minAmount) {
      return setError(`The minimum allowed by the network is ${minAmount} ${globalToken.symbol}.`);
    }

    // --- VALIDATION 2: INSUFFICIENT TOKEN BALANCE ---
    // For SOL: we need Link Value + Gas Fee (both in SOL)
    // For other tokens: we need Link Value in token, Gas Fee is paid separately in SOL
    if (globalToken.symbol === "SOL") {
      const totalRequired = numAmount + gasFee;
      if (totalRequired > globalBalance) {
        return setError(`Insufficient balance. You need ${totalRequired.toFixed(4)} SOL (Amount + Gas).`);
      }
    } else {
      // For SPL tokens, just check if we have enough of the token
      if (numAmount > globalBalance) {
        return setError(`Insufficient balance. You have ${globalBalance.toFixed(4)} ${globalToken.symbol}.`);
      }
      // Gas fee will be checked when signing - user needs SOL in public wallet
    }

    // Start Process
    setView("processing");
    setSteps((prev) => prev.map((s) => ({ ...s, status: "pending", detail: "" })));

    try {
      // 1. Compliance
      updateStep("compliance", "loading");
      const complianceRes = await fetch("/api/compliance", {
        method: "POST",
        body: JSON.stringify({ address: publicKey.toBase58() })
      });
      const compliance = await complianceRes.json();
      if (!compliance.allowed) {
        updateStep("compliance", "error");
        throw new Error("Wallet blocked by Compliance.");
      }
      updateStep("compliance", "success");

      // 2. Keygen & Link Hash
      updateStep("keygen", "loading");
      const tempKeypair = Keypair.generate();
      const tempPublicKey = tempKeypair.publicKey.toBase58();
      const secretKeyEncoded = bs58.encode(tempKeypair.secretKey);
      // For transfer(), SDK expects token symbol (e.g.: "SOL", "USD1", "USDC")
      // Note: deposit() uses token_mint (address), but transfer() uses token (symbol)
      const tokenSymbol = globalToken.symbol;

      // Secure link with Hash (#)
      const linkUrl = `${window.location.origin}/claim?t=${globalToken.symbol}&a=${amount}#${secretKeyEncoded}`;
      localStorage.setItem("vanta_last_link", linkUrl);

      // ⚠️ SAVE TO HISTORY BEFORE TRANSFER (for recovery in case of error)
      const linkId = saveLinkToHistory({
        secretKey: secretKeyEncoded,
        amount: amount,
        symbol: globalToken.symbol,
        mint: globalToken.mintAddress,
        decimals: globalToken.decimals,
        status: "pending", // Mark as pending until complete
        txSignature: null
      });
      updateStep("keygen", "success");

      let transferCompleted = false;

      try {
        // 3. ZK Transfer (Radr) - The Real Value
        updateStep("zkproof", "loading");
        const client = new ShadowWireClient();

        // SDK transfer() expects value in normal units (e.g.: 0.5 SOL, not lamports)
        // and token as symbol (not mint address)
        const result = await client.transfer({
          sender: publicKey.toBase58(),
          recipient: tempPublicKey,
          amount: numAmount,
          token: tokenSymbol as SdkTokenType,
          type: "external",
          wallet: { signMessage }
        });

        // Handle signature if needed
        if ((result as any).unsigned_tx_base64) {
          const txBuffer = Buffer.from((result as any).unsigned_tx_base64, "base64");
          const transaction = Transaction.from(txBuffer);
          const signature = await sendTransaction(transaction, connection);
          await connection.confirmTransaction(signature, "confirmed");
        } else if (!result.success && !result.tx_signature) {
          throw new Error((result as any).error || "Erro no SDK Radr");
        }

        transferCompleted = true; // Funds have been transferred
        updateStep("zkproof", "success");

        // 4. Public Gas (dynamic fee)
        // This ensures the receiver can claim without having SOL in wallet
        updateStep("transfer", "loading", "Adding Gas...");
        const gasLamports = Math.ceil(gasFee * 1e9); // Use dynamic gas fee
        const gasTx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: tempKeypair.publicKey,
            lamports: gasLamports
          })
        );
        const gasSig = await sendTransaction(gasTx, connection);
        await connection.confirmTransaction(gasSig, "confirmed");
        updateStep("transfer", "success");

        // ✅ All ok - Update status to complete
        updateLinkInHistory(linkId, {
          status: "complete",
          txSignature: gasSig,
          gasFee: gasFee // Store the gas fee used
        });
      } catch (innerError: any) {
        // If error BUT ZK transfer was already done, keep in history for refund
        if (transferCompleted) {
          updateLinkInHistory(linkId, {
            status: "partial", // Funds in temp wallet, but no gas
            error: innerError.message
          });
          throw new Error(`Funds transferred but gas error occurred. Use History to recover. (${innerError.message})`);
        } else {
          // If ZK transfer wasn't done, remove from history (nothing was lost)
          removeLinkFromHistory(linkId);
          throw innerError;
        }
      }

      setGeneratedLink(linkUrl);
      if (onSuccess) onSuccess(); // Update parent balance
      setView("success");
    } catch (e: any) {
      console.error(e);
      updateStep("transfer", "error", e.message);
      // Return to input after 3s to fix error
      setTimeout(() => {
        setView("input");
        setError(e.message);
      }, 3000);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // --- SCREEN 1: INPUT ---
  if (view === "input") {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
        {/* Left Column: Input */}
        <Card className="bg-card/50 border-border/50 h-full">
          <CardContent className="p-8 flex flex-col justify-between h-full">
            <div>
              {/* Header */}
              <div className="flex justify-between items-center mb-12">
                <div className="bg-primary/10 border border-primary/20 px-3 py-1 rounded-full text-xs text-primary font-bold flex items-center gap-2">
                  <Gift size={14} /> Vanta Link
                </div>
                {globalBalance > 0 ? (
                  <span className="text-[10px] text-green-400 flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> Online
                  </span>
                ) : (
                  <span className="text-[10px] text-destructive">No Balance</span>
                )}
              </div>

              {/* Big Input */}
              <div className="text-center mb-8 relative">
                <div className="flex justify-center items-end gap-2">
                  <span className="text-4xl text-muted-foreground font-bold mb-4">
                    {globalToken.symbol.includes("USD") ? "$" : ""}
                  </span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="bg-transparent text-6xl font-bold text-foreground text-center w-full outline-none placeholder:text-muted/20"
                  />
                </div>

                <div className="flex justify-center mt-6">
                  <div className="flex items-center gap-2 bg-muted/30 px-4 py-2 rounded-full border border-border/50">
                    <Image
                      src={globalToken.icon}
                      className="rounded-full"
                      alt={globalToken.symbol}
                      width={24}
                      height={24}
                    />
                    <span className="text-foreground font-bold text-lg">{globalToken.symbol}</span>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground mt-4 text-center">
                  Available: {globalBalance.toFixed(4)} {globalToken.symbol}
                </p>
              </div>
            </div>

            {/* Error UI */}
            {error && (
              <div className="flex items-center gap-2 justify-center mb-6 text-destructive animate-in fade-in slide-in-from-top-1 bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                <AlertCircle size={16} />
                <span className="text-sm font-medium">{error}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column: Breakdown & Action */}
        <div className="flex flex-col gap-4">
          <Card className="flex-1 bg-muted/10 border-border/50">
            <CardContent className="p-6 h-full flex flex-col">
              <h3 className="text-sm font-bold text-muted-foreground uppercase mb-6 tracking-wider">
                Transaction Details
              </h3>

              {!amount || Number(amount) <= 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/30 space-y-4">
                  <Info size={48} />
                  <p className="text-sm text-center max-w-50">Enter an amount to see the breakdown</p>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                  <div className="bg-background/50 p-4 rounded-xl border border-border/50 text-sm space-y-3">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Link Amount</span>
                      <span className="text-foreground font-mono">
                        {Number(amount).toFixed(4)} {globalToken.symbol}
                      </span>
                    </div>

                    <div className="flex justify-between text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Info size={12} /> Protocol Fee ({(getTokenFeePercentage(globalToken.symbol) * 100).toFixed(1)}
                        %)
                      </span>
                      <span className="text-orange-400 font-mono">
                        -{(Number(amount) * getTokenFeePercentage(globalToken.symbol)).toFixed(4)} {globalToken.symbol}
                      </span>
                    </div>

                    <div className="flex justify-between text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Info size={12} /> Gas Fee (Gasless)
                      </span>
                      <span className="text-yellow-500 font-mono">+{gasFee.toFixed(4)} SOL</span>
                    </div>

                    <div className="border-t border-border pt-3 flex justify-between text-muted-foreground">
                      <span>Recipient receives</span>
                      <span className="text-primary font-mono text-lg font-bold">
                        ~{(Number(amount) * (1 - getTokenFeePercentage(globalToken.symbol))).toFixed(4)}{" "}
                        {globalToken.symbol}
                      </span>
                    </div>
                  </div>

                  <div className="bg-secondary/5 p-4 rounded-xl border border-secondary/20">
                    <div className="flex justify-between font-bold items-center">
                      <span className="text-secondary text-xs uppercase tracking-wider">Total Debit</span>
                      <span className="text-secondary text-xl font-mono">
                        {Number(amount).toFixed(4)} {globalToken.symbol}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Button
            onClick={handleCreateLink}
            disabled={!amount || Number(amount) <= 0}
            className="w-full py-8 text-xl font-bold shadow-lg hover:shadow-xl transition-all"
            size="lg"
          >
            Generate Private Link
          </Button>
        </div>
      </div>
    );
  }

  // --- SCREEN 2: PROCESSING ---
  if (view === "processing") {
    return (
      <Card className="max-w-md mx-auto p-6 bg-card rounded-3xl border border-border shadow-xl">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-2xl">⚙️</span>
          </div>
          <h3 className="text-foreground font-bold">Creating Vanta Link...</h3>
          <p className="text-muted-foreground text-xs mt-1">Ensuring anonymity via ZK Proofs.</p>
        </div>
        <ProcessStatus steps={steps} />
      </Card>
    );
  }

  // --- SCREEN 3: SUCCESS ---
  return (
    <Card className="max-w-md mx-auto p-6 bg-card rounded-3xl border border-border shadow-2xl animate-fade-in">
      <CardContent>
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-1 text-foreground">Ready! 🎉</h2>
          <p className="text-muted-foreground text-sm mb-6">Funds wrapped successfully.</p>

          <div className="bg-white p-4 rounded-xl inline-block mb-6">
            <QRCode
              size={200}
              value={generatedLink}
              bgColor="#ffffff"
              fgColor="#000000"
              style={{ height: "auto", maxWidth: "100%", width: "100%" }}
            />
          </div>

          <div className="flex gap-2 mb-4">
            <Input readOnly value={generatedLink} className="flex-1 font-mono text-xs" />
            <Button onClick={copyToClipboard} size="icon" variant={copied ? "default" : "secondary"}>
              {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
            </Button>
          </div>

          <div className="bg-muted/30 p-4 rounded-xl border border-border mb-4">
            <p className="text-[10px] text-muted-foreground uppercase font-bold mb-2">Wrapped Amount</p>
            <div className="flex items-center gap-3">
              <Image src={globalToken.icon} alt={globalToken.symbol} width={38} height={38} className="rounded-full" />
              <div className="flex items-center w-full justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-xl font-bold text-foreground">{amount}</span>
                  <span className="text-md text-muted-foreground font-medium">{globalToken.symbol}</span>
                </div>
                <span className="text-lg text-muted-foreground font-medium">{globalToken.symbol}</span>
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            onClick={() => {
              setView("input");
              setGeneratedLink("");
              setAmount("");
            }}
            className="mt-4 text-muted-foreground hover:text-foreground font-medium"
          >
            ← Create New Link
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
