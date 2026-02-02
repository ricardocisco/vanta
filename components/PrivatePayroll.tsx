/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { Buffer } from "buffer";
import { useState, useEffect } from "react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { ShadowWireClient, SUPPORTED_TOKENS as SDK_TOKENS } from "@radr/shadowwire";
import { Card, CardContent } from "@/components/ui/card";
import { ComplianceBadge } from "./ui/ComplianceBadge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { ProcessStatus, ProcessStep } from "./ProcessStatus";
import { TokenOption } from "@/lib/tokens";
import { getTokenFeePercentage } from "@/lib/fees";
import { Check, ShieldCheck, Lock, Send } from "lucide-react";

// SDK Token Type
type SdkTokenType = (typeof SDK_TOKENS)[number];

// Props received from Parent (ShadowTerminal)
interface PrivatePayrollProps {
  selectedToken: TokenOption;
  privateBalance: number;
  onSuccess: () => void; // Para atualizar saldo após envio
}

export default function PrivatePayroll({ selectedToken, privateBalance, onSuccess }: PrivatePayrollProps) {
  const { publicKey, signMessage, connected, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const [loading, setLoading] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [feeEstimate, setFeeEstimate] = useState("0");
  const [resultTxs, setResultTxs] = useState<Array<{ label: string; hash: string }>>([]);
  const [formError, setFormError] = useState<string | null>(null);

  // Parseia o formato "TX1:hash TX2:hash" do SDK
  const parseTransactionSignatures = (raw: string): Array<{ label: string; hash: string }> => {
    // Formato: "TX1:signature1 TX2:signature2"
    const txPattern = /(TX\d+):([A-Za-z0-9]+)/g;
    const matches = [...raw.matchAll(txPattern)];

    if (matches.length > 0) {
      return matches.map((match) => ({
        label: match[1] === "TX1" ? "Vault Deposit" : "Private Transfer",
        hash: match[2]
      }));
    }

    // Fallback: if not expected format, return as single tx
    return [{ label: "Transaction", hash: raw }];
  };

  // Steps Visuais - Usando formato compatível com ProcessStatus
  const [complianceStatus, setComplianceStatus] = useState<"idle" | "loading" | "safe" | "risk">("idle");
  const [processSteps, setProcessSteps] = useState<ProcessStep[]>([
    { id: "compliance", label: "Range Validation", status: "pending", icon: ShieldCheck },
    { id: "zkproof", label: "ZK Proof (Radr)", status: "pending", icon: Lock },
    { id: "relayer", label: "Relayer (Helius)", status: "pending", icon: Send }
  ]);

  // Fee Estimate Calculation
  useEffect(() => {
    const calcFee = () => {
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        setFeeEstimate("0");
        return;
      }
      const feePercentage = getTokenFeePercentage(selectedToken.symbol);
      const calculatedFee = Number(amount) * feePercentage;
      setFeeEstimate(calculatedFee.toFixed(selectedToken.decimals));
    };
    const timeout = setTimeout(calcFee, 300);
    return () => clearTimeout(timeout);
  }, [amount, selectedToken]);

  const updateStep = (index: number, status: "loading" | "success" | "error") => {
    setProcessSteps((prev) => {
      const newSteps = [...prev];
      newSteps[index] = { ...newSteps[index], status };
      return newSteps;
    });
  };

  const handleCheckWallet = async () => {
    if (!recipient) return setFormError("Enter address to verify.");
    try {
      new PublicKey(recipient);
    } catch {
      return setFormError("Invalid address format.");
    }

    setComplianceStatus("loading");
    setFormError(null);

    try {
      const res = await fetch("/api/compliance", {
        method: "POST",
        body: JSON.stringify({ address: recipient })
      });
      const data = await res.json();

      if (!data.allowed) {
        setComplianceStatus("risk");
        const riskInfo = data.detail;
        const riskMessage = riskInfo?.riskLevel || data.reason || "High Risk";

        setFormError(`⚠️ Wallet Flagged: ${riskMessage}`);
      } else {
        setComplianceStatus("safe");
      }
    } catch (e) {
      console.error(e);
      setComplianceStatus("idle");
      setFormError("Failed to verify wallet.");
    }
  };

  const handlePay = async () => {
    setFormError(null);
    if (!connected || !publicKey || !signMessage) return setFormError("Connect your wallet.");
    if (!recipient) return setFormError("Enter the address.");
    try {
      new PublicKey(recipient);
    } catch {
      return setFormError("Invalid address.");
    }
    if (isNaN(Number(amount)) || Number(amount) <= 0) return setFormError("Invalid amount.");

    setLoading(true);
    setProcessSteps([
      { id: "compliance", label: "Range Validation", status: "loading" },
      { id: "zkproof", label: "ZK Proof (Radr)", status: "pending" },
      { id: "relayer", label: "Relayer (Helius)", status: "pending" }
    ]);

    try {
      // 1. Compliance
      setComplianceStatus("loading");
      const rangeCheck = await fetch("/api/compliance", {
        method: "POST",
        body: JSON.stringify({ address: recipient })
      });
      const compliance = await rangeCheck.json();

      if (!compliance.allowed) {
        setComplianceStatus("risk");
        updateStep(0, "error");

        const riskInfo = compliance.detail;
        const riskMessage = riskInfo?.riskLevel || compliance.reason || "Alto Risco";
        const category = riskInfo?.maliciousAddressesFound?.[0]?.category || "";
        const hops = riskInfo?.numHops;

        setFormError(
          `🚫 Recipient Blocked | Score: ${compliance.riskScore ?? "N/A"}/10` +
            (hops !== undefined ? ` | Hops: ${hops}` : "") +
            ` | ${riskMessage}` +
            (category ? ` | Category: ${category}` : "")
        );
        setLoading(false);
        return; // Stop flow without throw
      }
      setComplianceStatus("safe");
      updateStep(0, "success");

      // 2. Transfer
      updateStep(1, "loading");
      const client = new ShadowWireClient();

      // SDK transfer() expects value in normal units (e.g.: 0.5 SOL, not lamports)
      const amountToSend = Number(amount);

      const result = await client.transfer({
        sender: publicKey.toBase58(),
        recipient: recipient,
        amount: amountToSend,
        token: selectedToken.symbol as SdkTokenType,
        type: "external",
        wallet: { signMessage }
      });

      updateStep(1, "success");
      updateStep(2, "loading");

      if ((result as any).unsigned_tx_base64) {
        const txBuffer = Buffer.from((result as any).unsigned_tx_base64, "base64");
        const transaction = Transaction.from(txBuffer);
        const signature = await sendTransaction(transaction, connection);
        await connection.confirmTransaction(signature, "confirmed");
        updateStep(2, "success");
        onSuccess(); // Update parent balance
      } else if (result.success && result.tx_signature) {
        console.log("Relayer Success:", result.tx_signature);
        updateStep(2, "success");

        // Parse multiple transactions
        const txs = parseTransactionSignatures(result.tx_signature);
        setResultTxs(txs);
        setAmount("");
        onSuccess(); // Update parent balance
      } else {
        throw new Error((result as any).error || "Unknown error.");
      }
    } catch (error: any) {
      console.error(error);
      const activeIdx = processSteps.findIndex((s) => s.status === "loading");
      if (activeIdx !== -1) updateStep(activeIdx, "error");
      setFormError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-8 animate-fade-in">
      {/* Coluna Esquerda: Form */}
      <Card className="flex-1 border-none shadow-none bg-transparent p-0">
        <CardContent className="space-y-5 p-0">
          {/* Recipient Input */}
          <div>
            <Label className="text-xs text-muted-foreground uppercase font-bold">Recipient</Label>
            <div className="flex gap-2 mt-2">
              <Input
                value={recipient}
                onChange={(e) => {
                  setRecipient(e.target.value);
                  setComplianceStatus("idle"); // Reset status on change
                }}
                placeholder="Solana Address..."
                className="w-full bg-input border-border p-3 h-11 rounded text-foreground focus:border-primary font-mono text-sm"
              />
              <Button
                onClick={handleCheckWallet}
                disabled={!recipient || complianceStatus === "loading"}
                variant="outline"
                className="h-11 border-border font-bold"
              >
                Verify
              </Button>
            </div>
            <div className="mt-2 h-6 flex justify-between items-center">
              <ComplianceBadge status={complianceStatus} />
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <Label className="text-xs text-muted-foreground uppercase font-bold flex justify-between">
              <span>Amount ({selectedToken.symbol})</span>
              <span className="text-muted-foreground/80">
                Avail: {(privateBalance - Number(feeEstimate)).toFixed(4)}
              </span>
            </Label>
            <div className="relative mt-2">
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-input border-border p-3 h-11 rounded text-foreground focus:border-primary pr-16"
              />
              <Button
                onClick={() => {
                  const feePct = getTokenFeePercentage(selectedToken.symbol);
                  const max = privateBalance / (1 + feePct);
                  setAmount(max.toFixed(selectedToken.decimals));
                }}
                size="sm"
                variant="secondary"
                className="absolute right-2 top-1.5 h-8 text-[10px] bg-secondary/20 hover:bg-secondary/40 text-secondary font-bold"
              >
                MAX
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Fee: ~{feeEstimate} {selectedToken.symbol}
            </p>
          </div>

          <Button
            onClick={handlePay}
            disabled={loading || Number(amount) <= 0}
            className="w-full py-6 hover:brightness-110 text-primary-foreground rounded-lg font-bold shadow-[0_0_20px_hsl(135,100%,50%,0.3)] hover:shadow-[0_0_30px_hsl(135,100%,50%,0.5)] transition-shadow"
          >
            {loading ? "Processing..." : "Send Payment"}
          </Button>

          {formError && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded text-center text-destructive text-xs font-bold">
              {formError}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="w-full md:w-1/3 md:border-l border-separate md:pl-6 pt-6 md:pt-0">
        <ProcessStatus steps={processSteps} title="Progress" />

        {resultTxs.length > 0 && (
          <div className="mt-6 p-4 bg-primary/10 border border-primary/20 rounded-lg">
            <p className="text-[10px] text-primary font-bold uppercase text-center mb-3">
              <span>
                <Check />
              </span>
              Transfer Complete
            </p>
            <div className="space-y-2">
              {resultTxs.map((tx, idx) => (
                <div key={idx} className="flex items-center justify-between bg-black/20 px-3 py-2 rounded-lg">
                  <span className="text-[10px] text-gray-400 font-medium">{tx.label}</span>
                  <a
                    href={`https://solscan.io/tx/${tx.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-green-400 hover:text-green-300 font-mono flex items-center gap-1"
                  >
                    {tx.hash.slice(0, 8)}...{tx.hash.slice(-8)} ↗
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
