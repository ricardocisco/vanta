/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Keypair, Transaction, SystemProgram, PublicKey } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount
} from "@solana/spl-token";
import bs58 from "bs58";
import { ProcessStatus, ProcessStep, StepStatus } from "@/components/ProcessStatus";
import { SUPPORTED_TOKENS, TokenOption } from "@/lib/tokens";
import { getTokenFeePercentage } from "@/lib/fees";
import { Gift, PartyPopper, ShieldX, Sparkles, Search, ShieldCheck, Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";

const FEE_BUFFER = 5000;

function ClaimContent() {
  const searchParams = useSearchParams();
  const { connection } = useConnection();
  const { publicKey } = useWallet();

  const tokenSymbol = searchParams.get("t") || "SOL";
  const amountDisplay = searchParams.get("a") || "---";

  // Calculate net amount (after protocol fee)
  const grossAmount = parseFloat(amountDisplay) || 0;
  const feePercentage = getTokenFeePercentage(tokenSymbol);
  const netAmount = grossAmount * (1 - feePercentage);

  // Get token info to display icon
  const tokenInfo: TokenOption | undefined = SUPPORTED_TOKENS.find((t) => t.symbol === tokenSymbol);

  const [status, setStatus] = useState<"idle" | "checking" | "claiming" | "success" | "error">("checking");
  const [txHash, setTxHash] = useState("");
  const [tempKeypair, setTempKeypair] = useState<Keypair | null>(null);
  const [complianceError, setComplianceError] = useState<string | null>(null);

  const [steps, setSteps] = useState<ProcessStep[]>([
    { id: "validate", label: "Validating Link", status: "pending", icon: Search },
    { id: "range", label: "Checking Compliance", status: "pending", icon: ShieldCheck },
    { id: "transfer", label: "Gasless Transfer", status: "pending", icon: Download }
  ]);

  const updateStep = (id: string, status: StepStatus) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  };

  console.log(tempKeypair?.publicKey?.toBase58());

  // 1. READ HASH FRAGMENT ON LOAD
  useEffect(() => {
    const loadSecret = async () => {
      try {
        // Get hash from URL (e.g.: #5Ks...)
        const hash = window.location.hash.slice(1);
        if (!hash) throw new Error("Incomplete link");

        const secretKey = bs58.decode(hash);
        const keypair = Keypair.fromSecretKey(secretKey);
        setTempKeypair(keypair);

        // Check if temp wallet still has SOL (to pay gas)
        const solBalance = await connection.getBalance(keypair.publicKey);
        console.log("[Claim] Temp wallet SOL balance:", solBalance / 1e9);

        if (solBalance < FEE_BUFFER) {
          console.error("[Claim] Insufficient SOL for gas fees");
          setStatus("error");
          return;
        }

        // For SPL tokens, check if temp wallet has tokens in ATA
        if (tokenSymbol !== "SOL" && tokenInfo) {
          try {
            const mint = new PublicKey(tokenInfo.mintAddress);
            const tempAta = await getAssociatedTokenAddress(mint, keypair.publicKey);
            const tokenAccount = await getAccount(connection, tempAta);
            const tokenBalance = Number(tokenAccount.amount) / Math.pow(10, tokenInfo.decimals);
            console.log("[Claim] Temp wallet token balance:", tokenBalance, tokenSymbol);

            if (tokenAccount.amount <= BigInt(0)) {
              console.warn("[Claim] Link has no token balance, may have been claimed already");
            }
          } catch (e) {
            console.warn("[Claim] Could not check token balance (ATA may not exist):", e);
          }
        }

        setStatus("idle");
        updateStep("validate", "success");
      } catch (e) {
        console.error(e);
        setStatus("error");
        updateStep("validate", "error");
      }
    };
    loadSecret();
  }, [connection, tokenSymbol, tokenInfo]);

  const handleClaim = async () => {
    if (!publicKey || !tempKeypair) return alert("Connect wallet or invalid link");

    setStatus("claiming");
    setComplianceError(null);

    try {
      // 2. Compliance Check
      updateStep("range", "loading");
      const rangeRes = await fetch("/api/compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: publicKey.toBase58() })
      });
      const compliance = await rangeRes.json();

      if (!compliance.allowed) {
        updateStep("range", "error");
        const riskInfo = compliance.detail;
        const riskMessage = riskInfo?.riskLevel || compliance.reason || "Alto Risco";
        const category = riskInfo?.maliciousAddressesFound?.[0]?.category || "";
        const hops = riskInfo?.numHops;

        setComplianceError(
          `🚫 Wallet Blocked | Score: ${compliance.riskScore ?? "N/A"}/10` +
            (hops !== undefined ? ` | Hops: ${hops}` : "") +
            `\n${riskMessage}` +
            (category ? `\nCategory: ${category}` : "")
        );
        setStatus("error");
        return;
      }
      updateStep("range", "success");

      // 3. Transfer to receiver
      updateStep("transfer", "loading");

      const transaction = new Transaction();

      if (tokenSymbol === "SOL") {
        // --- SOL: Direct transfer from temp wallet public balance ---
        const balance = await connection.getBalance(tempKeypair.publicKey);
        const amountToSend = balance - FEE_BUFFER; // Leave some for fee

        transaction.add(
          SystemProgram.transfer({
            fromPubkey: tempKeypair.publicKey,
            toPubkey: publicKey,
            lamports: amountToSend
          })
        );
        console.log(tempKeypair?.publicKey?.toBase58());
      } else {
        const tokenInfoData = SUPPORTED_TOKENS.find((t) => t.symbol === tokenSymbol);
        if (!tokenInfoData) throw new Error("Unknown token");

        const mint = new PublicKey(tokenInfoData.mintAddress);

        // Get ATA addresses
        const tempAta = await getAssociatedTokenAddress(mint, tempKeypair.publicKey);
        const receiverAta = await getAssociatedTokenAddress(mint, publicKey);

        // Check temp wallet's token balance
        let tokenAmount: bigint;
        try {
          const tokenAccount = await getAccount(connection, tempAta);
          tokenAmount = tokenAccount.amount;
          console.log(
            "[Claim] Token balance in temp ATA:",
            Number(tokenAmount) / Math.pow(10, tokenInfoData.decimals),
            tokenSymbol
          );
        } catch (e) {
          console.error("[Claim] Could not find token account:", e);
          throw new Error("Link already claimed or no balance available");
        }

        if (tokenAmount <= BigInt(0)) {
          throw new Error("Link already claimed or no balance available");
        }

        // Check if receiver has ATA, if not create it (temp wallet pays)
        try {
          await getAccount(connection, receiverAta);
        } catch {
          transaction.add(createAssociatedTokenAccountInstruction(tempKeypair.publicKey, receiverAta, publicKey, mint));
        }

        transaction.add(createTransferInstruction(tempAta, receiverAta, tempKeypair.publicKey, tokenAmount));
      }

      // GASLESS CONFIGURATION
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      transaction.feePayer = tempKeypair.publicKey;

      // Sign and send
      transaction.sign(tempKeypair);
      const signature = await connection.sendRawTransaction(transaction.serialize());
      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight });
      setTxHash(signature);

      updateStep("transfer", "success");
      setStatus("success");
    } catch (e: any) {
      console.error(e);

      if (!complianceError) {
        updateStep("transfer", "error");
      }
      setStatus("error");
    }
  };

  // --- UI RENDER ---
  return (
    <div className="min-h-screen bg-background flex flex-col items-center p-4">
      {/* Header with connect button */}
      <Navbar />

      <Card className="max-w-md w-full p-8 text-center relative overflow-hidden">
        {/* Status Visual */}
        <div className="mb-4 flex justify-center">
          {status === "success" ? (
            <PartyPopper className="w-16 h-16 text-green-500" />
          ) : status === "error" ? (
            <ShieldX className="w-16 h-16 text-destructive" />
          ) : (
            <Gift className="w-16 h-16 text-secondary" />
          )}
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">
          {status === "success" ? "Claim Complete!" : "Vanta Link Received"}
        </h1>

        {status !== "error" && (
          <div className="bg-muted/50 p-5 rounded-xl mb-6 border border-input">
            <p className="text-[10px] text-muted-foreground uppercase font-bold mb-2">You&apos;re Receiving</p>
            <div className="flex items-center gap-3">
              {tokenInfo?.icon && (
                <Image src={tokenInfo.icon} alt={tokenSymbol} width={40} height={40} className="rounded-full" />
              )}

              <div className="flex items-center w-full justify-between gap-3">
                <div className="flex flex-col items-start">
                  <span className="text-xl font-bold text-foreground">{netAmount.toFixed(2)}</span>
                  <span className="text-md text-muted-foreground font-medium">{tokenSymbol}</span>
                </div>
                <span className="text-lg text-muted-foreground font-medium">{tokenSymbol}</span>
              </div>
            </div>

            {/* Gasless Badge */}
            <div className="mt-3 flex items-center justify-center gap-2 text-green-500 text-xs font-medium bg-green-500/10 py-2 px-3 rounded-lg border border-green-500/20">
              <Sparkles size={14} />
              <span>Gasless — No fees for you!</span>
            </div>
          </div>
        )}

        {status === "error" && complianceError && (
          <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-xl mb-6 text-left">
            <p className="text-destructive text-sm font-medium whitespace-pre-line">{complianceError}</p>
            <p className="text-muted-foreground text-xs mt-2">
              This wallet is on a risk list and cannot receive funds.
            </p>
          </div>
        )}

        {status === "error" && !complianceError && (
          <div className="bg-destructive/10 p-4 rounded-xl mb-6 text-destructive text-sm">
            Invalid or already claimed link.
          </div>
        )}

        {status === "success" ? (
          <a href={`https://solscan.io/tx/${txHash}`} target="_blank" className="block w-full">
            <Button className="w-full">Ver no Solscan ↗</Button>
          </a>
        ) : (
          <Button
            onClick={handleClaim}
            disabled={status !== "idle" || !publicKey}
            className="w-full font-bold transition-all disabled:opacity-50"
            size="lg"
            variant={!publicKey ? "secondary" : "default"}
          >
            {!publicKey ? "Connect Wallet" : status === "claiming" ? "Processing..." : "Claim (Gasless)"}
          </Button>
        )}

        <div className="mt-8 text-left">
          <ProcessStatus steps={steps} />
        </div>
      </Card>
    </div>
  );
}

export default function ClaimPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center text-foreground">
          Loading Link...
        </div>
      }
    >
      <ClaimContent />
    </Suspense>
  );
}
