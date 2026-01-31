/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Keypair, Transaction, SystemProgram } from "@solana/web3.js";
import bs58 from "bs58";
import { ShadowWireClient, SUPPORTED_TOKENS as SDK_TOKENS } from "@radr/shadowwire";
import QRCode from "react-qr-code";
import { ProcessStatus } from "./ProcessStatus";
import { TokenOption } from "@/lib/tokens";
import { calculateLinkGasFee, getTokenMinimumAmount, getTokenFeePercentage } from "@/lib/fees";
import { AlertCircle, CheckCircle, Copy, Gift, Info } from "lucide-react";

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
  const [steps, setSteps] = useState([
    { id: "compliance", label: "Range Verification (Compliance)", status: "pending" as any },
    { id: "keygen", label: "Generating Temporary Keys", status: "pending" as any },
    { id: "zkproof", label: "Radr: Privacy Proof", status: "pending" as any },
    { id: "transfer", label: "Transfer to Link", status: "pending" as any }
  ]);

  const updateStep = (id: string, status: "loading" | "success" | "error", detail?: string) => {
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
      <div className="w-full max-w-md mx-auto bg-[#0F1115] rounded-3xl border border-gray-800 p-6 shadow-2xl relative">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="bg-purple-900/30 border border-purple-500/30 px-3 py-1 rounded-full text-xs text-purple-300 font-bold flex items-center gap-2">
            <span>
              <Gift />
            </span>{" "}
            Vanta Link
          </div>
          {globalBalance > 0 ? (
            <span className="text-[10px] text-green-400 flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Online
            </span>
          ) : (
            <span className="text-[10px] text-red-400">No Balance</span>
          )}
        </div>

        {/* Big Input */}
        <div className="text-center mb-8 relative">
          <div className="flex justify-center items-end gap-2">
            <span className="text-4xl text-gray-500 font-bold mb-4">
              {globalToken.symbol.includes("USD") ? "$" : ""}
            </span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="bg-transparent text-6xl font-bold text-white text-center w-full outline-none placeholder-gray-800"
            />
          </div>

          {/* TOKEN BADGE (Não clicável, apenas informativo) */}
          <div className="flex justify-center mt-4">
            <div className="flex items-center gap-2 bg-gray-800/50 px-4 py-2 rounded-full border border-gray-700/50">
              <Image src={globalToken.icon} className="rounded-full" alt={globalToken.symbol} width={20} height={20} />
              <span className="text-white font-bold">{globalToken.symbol}</span>
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-2">
            Available: {globalBalance.toFixed(4)} {globalToken.symbol}
          </p>
        </div>

        {/* --- ERROR UI FIX --- */}
        {error && (
          <div className="flex items-center gap-2 justify-center mb-6 text-red-400 animate-in fade-in slide-in-from-top-1">
            <AlertCircle size={16} />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {/* Cost Breakdown (Only shows if valid value) */}
        {!error && amount && Number(amount) > 0 && (
          <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800 text-xs space-y-2 mb-6">
            <div className="flex justify-between text-gray-400">
              <span>Link Amount</span>
              <span className="text-white font-mono">
                {Number(amount).toFixed(4)} {globalToken.symbol}
              </span>
            </div>

            {/* Protocol Fee (SDK) */}
            <div className="flex justify-between text-gray-400">
              <span className="flex items-center gap-1">
                <Info size={10} /> Protocol Fee ({(getTokenFeePercentage(globalToken.symbol) * 100).toFixed(1)}%)
              </span>
              <span className="text-orange-400 font-mono">
                -{(Number(amount) * getTokenFeePercentage(globalToken.symbol)).toFixed(4)} {globalToken.symbol}
              </span>
            </div>

            {/* Gas Fee (Blockchain) */}
            <div className="flex justify-between text-gray-400">
              <span className="flex items-center gap-1">
                <Info size={10} /> Gas Fee (Gasless)
              </span>
              <span className="text-yellow-500 font-mono">+{gasFee.toFixed(4)} SOL</span>
            </div>

            {/* Recipient will receive */}
            <div className="border-t border-gray-700 pt-2 flex justify-between text-gray-400">
              <span>Recipient receives</span>
              <span className="text-green-400 font-mono">
                ~{(Number(amount) * (1 - getTokenFeePercentage(globalToken.symbol))).toFixed(4)} {globalToken.symbol}
              </span>
            </div>

            {/* Total to Debit */}
            <div className="flex justify-between font-bold">
              <span className="text-gray-300">Total Cost</span>
              <span className="text-purple-300 font-mono">
                {Number(amount).toFixed(4)} {globalToken.symbol}
                {globalToken.symbol !== "SOL" && ` + ${gasFee.toFixed(4)} SOL`}
                {globalToken.symbol === "SOL" && ` + ${gasFee.toFixed(4)} SOL`}
              </span>
            </div>
          </div>
        )}

        <button
          onClick={handleCreateLink}
          disabled={Number(amount) <= 0}
          className="w-full py-4 bg-white hover:bg-gray-200 text-black font-bold rounded-2xl text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Generate Private Link
        </button>
      </div>
    );
  }

  // --- SCREEN 2: PROCESSING ---
  if (view === "processing") {
    return (
      <div className="max-w-md mx-auto p-6 bg-gray-900 rounded-3xl border border-gray-800 shadow-xl">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-2xl">⚙️</span>
          </div>
          <h3 className="text-white font-bold">Creating Vanta Link...</h3>
          <p className="text-gray-500 text-xs mt-1">Ensuring anonymity via ZK Proofs.</p>
        </div>
        <ProcessStatus steps={steps} />
      </div>
    );
  }

  // --- SCREEN 3: SUCCESS ---
  return (
    <div className="max-w-md mx-auto p-6 bg-[#0F1115] rounded-3xl border border-gray-800 shadow-2xl text-white animate-fade-in">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-1">Ready! 🎉</h2>
        <p className="text-gray-400 text-sm mb-6">Funds wrapped successfully.</p>

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
          <input
            readOnly
            value={generatedLink}
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 text-xs text-gray-300 truncate font-mono outline-none"
          />
          <button
            onClick={copyToClipboard}
            className="bg-purple-600 hover:bg-purple-700 text-white px-3 rounded-lg transition-colors"
          >
            {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
          </button>
        </div>

        <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800 mb-4">
          <p className="text-[10px] text-gray-500 uppercase font-bold mb-2">Wrapped Amount</p>
          <div className="flex items-center gap-3">
            <Image src={globalToken.icon} alt={globalToken.symbol} width={38} height={38} className="rounded-full" />
            <div className="flex items-center w-full justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-xl font-bold text-white">{amount}</span>
                <span className="text-md text-gray-400 font-medium">{globalToken.symbol}</span>
              </div>
              <span className="text-lg text-gray-400 font-medium">{globalToken.symbol}</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setView("input");
            setGeneratedLink("");
            setAmount("");
          }}
          className="mt-4 text-gray-500 text-sm hover:text-white font-medium transition-colors"
        >
          ← Create New Link
        </button>
      </div>
    </div>
  );
}
