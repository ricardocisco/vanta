/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Keypair, Transaction, SystemProgram, PublicKey } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount
} from "@solana/spl-token";
import bs58 from "bs58";
import { ProcessStatus } from "@/components/ProcessStatus";
import { SUPPORTED_TOKENS, TokenOption } from "@/lib/tokens";
import { getTokenFeePercentage } from "@/lib/fees";
import { Gift, PartyPopper, ShieldX, Sparkles } from "lucide-react";

const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((mod) => mod.WalletMultiButton),
  { ssr: false }
);

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

  const [steps, setSteps] = useState([
    { id: "validate", label: "Validating Link", status: "pending" as any },
    { id: "range", label: "Checking Compliance", status: "pending" as any },
    { id: "transfer", label: "Gasless Transfer", status: "pending" as any }
  ]);

  const updateStep = (id: string, status: "loading" | "success" | "error") => {
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
        return; // Stop flow without throw
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
        // --- SPL TOKEN: Transfer from temp wallet's ATA to receiver's ATA ---
        // Note: "external" transfer sends to public ATA, not private balance
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
          transaction.add(
            createAssociatedTokenAccountInstruction(
              tempKeypair.publicKey, // Payer (temp wallet pays the rent)
              receiverAta,
              publicKey,
              mint
            )
          );
        }

        // Transfer all tokens from temp ATA to receiver ATA
        transaction.add(
          createTransferInstruction(
            tempAta,
            receiverAta,
            tempKeypair.publicKey, // Owner (temp wallet signs)
            tokenAmount
          )
        );
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
      // Only mark transfer as error if not a compliance error (already handled)
      if (!complianceError) {
        updateStep("transfer", "error");
      }
      setStatus("error");
    }
  };

  // --- UI RENDER ---
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center p-4">
      {/* Header with connect button */}
      <div className="w-full max-w-md flex justify-between items-center mb-8 pt-4">
        <Link href="/" className="text-purple-400 hover:text-purple-300 text-sm font-bold flex items-center gap-2">
          👻 Vanta Protocol
        </Link>
        <WalletMultiButton style={{ backgroundColor: "transparent", height: "40px", fontSize: "12px" }} />
      </div>

      <div className="max-w-md w-full bg-[#0F1115] p-8 rounded-2xl border border-gray-800 text-center relative overflow-hidden">
        {/* Status Visual */}
        <div className="mb-4 flex justify-center">
          {status === "success" ? (
            <PartyPopper className="w-16 h-16 text-green-400" />
          ) : status === "error" ? (
            <ShieldX className="w-16 h-16 text-red-400" />
          ) : (
            <Gift className="w-16 h-16 text-purple-400" />
          )}
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">
          {status === "success" ? "Claim Complete!" : "Vanta Link Received"}
        </h1>

        {status !== "error" && (
          <div className="bg-gray-800/50 p-5 rounded-xl mb-6 border border-gray-700">
            <p className="text-[10px] text-gray-500 uppercase font-bold mb-2">You&apos;re Receiving</p>
            <div className="flex items-center gap-3">
              {tokenInfo?.icon && (
                <Image src={tokenInfo.icon} alt={tokenSymbol} width={40} height={40} className="rounded-full" />
              )}

              <div className="flex items-center w-full justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-xl font-bold text-white">{netAmount.toFixed(2)}</span>
                  <span className="text-md text-gray-400 font-medium">{tokenSymbol}</span>
                </div>
                <span className="text-lg text-gray-400 font-medium">{tokenSymbol}</span>
              </div>
            </div>

            {/* Gasless Badge */}
            <div className="mt-3 flex items-center justify-center gap-2 text-green-400 text-xs font-medium bg-green-900/20 py-2 px-3 rounded-lg border border-green-900/30">
              <Sparkles size={14} />
              <span>Gasless — No fees for you!</span>
            </div>
          </div>
        )}

        {status === "error" && complianceError && (
          <div className="bg-red-900/30 border border-red-500/50 p-4 rounded-xl mb-6 text-left">
            <p className="text-red-400 text-sm font-medium whitespace-pre-line">{complianceError}</p>
            <p className="text-gray-500 text-xs mt-2">This wallet is on a risk list and cannot receive funds.</p>
          </div>
        )}

        {status === "error" && !complianceError && (
          <div className="bg-red-900/20 p-4 rounded-xl mb-6 text-red-400 text-sm">Invalid or already claimed link.</div>
        )}

        {status === "success" ? (
          <a
            href={`https://solscan.io/tx/${txHash}`}
            target="_blank"
            className="block w-full py-4 bg-gray-800 text-white font-bold rounded-xl hover:bg-gray-700"
          >
            Ver no Solscan ↗
          </a>
        ) : (
          <button
            onClick={handleClaim}
            disabled={status !== "idle" || !publicKey}
            className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-all disabled:opacity-50"
          >
            {!publicKey ? "Connect Wallet" : status === "claiming" ? "Processing..." : "Claim (Gasless)"}
          </button>
        )}

        <div className="mt-8 text-left">
          <ProcessStatus steps={steps} />
        </div>
      </div>
    </div>
  );
}

export default function ClaimPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">Loading Link...</div>
      }
    >
      <ClaimContent />
    </Suspense>
  );
}
