/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useEffect, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Transaction, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";
import { ShadowWireClient, SUPPORTED_TOKENS as SDK_TOKENS } from "@radr/shadowwire";
import Image from "next/image";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { TokenOption } from "@/lib/tokens";
import { getTokenFeePercentage } from "@/lib/fees";
import { CheckCircle, AlertCircle, Loader2, Wallet, ArrowDownToLine, Lock, Pen, Radio } from "lucide-react";

// SDK Token Type
type SdkTokenType = (typeof SDK_TOKENS)[number];

interface WalletManagerProps {
  selectedToken: TokenOption;
  privateBalance: number;
  onUpdateBalance: () => void;
}

// Tipos para feedback visual
type FeedbackType = "success" | "error" | null;
type DepositStep = "idle" | "preparing" | "signing" | "confirming" | "done";

// Vertical Stepper Component for Deposit
function DepositStepper({ currentStep }: { currentStep: DepositStep }) {
  const steps = [
    { id: "preparing", label: "Preparing", description: "Generating ZK proof...", icon: Lock },
    { id: "signing", label: "Signing", description: "Confirm in wallet", icon: Pen },
    { id: "confirming", label: "Confirming", description: "Waiting for blockchain", icon: Radio },
    { id: "done", label: "Complete", description: "Deposit successful!", icon: CheckCircle }
  ];

  const getStepIndex = (step: DepositStep) => steps.findIndex((s) => s.id === step);
  const currentIndex = getStepIndex(currentStep);

  return (
    <div className="space-y-0">
      {steps.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isPending = index > currentIndex;
        const Icon = step.icon;
        const isLast = index === steps.length - 1;

        return (
          <div key={step.id} className="flex items-start gap-3">
            {/* Icon + Line */}
            <div className="flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isCompleted
                    ? "bg-green-500/20 text-green-400"
                    : isCurrent
                      ? "bg-purple-500/20 text-purple-400 ring-2 ring-purple-500/50"
                      : "bg-gray-700/50 text-gray-500"
                }`}
              >
                {isCompleted ? (
                  <CheckCircle size={14} />
                ) : isCurrent ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Icon size={14} />
                )}
              </div>
              {/* Connector Line */}
              {!isLast && (
                <div
                  className={`w-0.5 h-6 transition-all duration-300 ${isCompleted ? "bg-green-500/50" : "bg-gray-700"}`}
                />
              )}
            </div>

            {/* Text */}
            <div className={`pt-1 ${isPending ? "opacity-40" : ""}`}>
              <p
                className={`text-xs font-bold ${
                  isCompleted ? "text-green-400" : isCurrent ? "text-purple-400" : "text-gray-500"
                }`}
              >
                {step.label}
              </p>
              <p className="text-[10px] text-gray-500">{step.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function WalletManager({ selectedToken, privateBalance, onUpdateBalance }: WalletManagerProps) {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [depositStep, setDepositStep] = useState<DepositStep>("idle");
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  // Feedback visual
  const [feedback, setFeedback] = useState<{ type: FeedbackType; message: string }>({ type: null, message: "" });
  const [withdrawFeedback, setWithdrawFeedback] = useState<{ type: FeedbackType; message: string }>({
    type: null,
    message: ""
  });

  // Public wallet balance
  const [publicBalance, setPublicBalance] = useState<number>(0);
  const [loadingBalance, setLoadingBalance] = useState(false);

  // Fetch public wallet balance
  const fetchPublicBalance = useCallback(async () => {
    if (!publicKey) return;

    setLoadingBalance(true);
    try {
      if (selectedToken.symbol === "SOL") {
        const balance = await connection.getBalance(publicKey);
        setPublicBalance(balance / LAMPORTS_PER_SOL);
      } else {
        // SPL Token
        const mint = new PublicKey(selectedToken.mintAddress);
        const ata = await getAssociatedTokenAddress(mint, publicKey);
        try {
          const tokenAccount = await getAccount(connection, ata);
          setPublicBalance(Number(tokenAccount.amount) / Math.pow(10, selectedToken.decimals));
        } catch {
          setPublicBalance(0); // Account doesn't exist
        }
      }
    } catch (e) {
      console.error("Error fetching public balance:", e);
    } finally {
      setLoadingBalance(false);
    }
  }, [publicKey, connection, selectedToken]);

  useEffect(() => {
    fetchPublicBalance();
  }, [fetchPublicBalance]);

  // Clear feedback after 5 seconds
  useEffect(() => {
    if (feedback.type) {
      const timer = setTimeout(() => setFeedback({ type: null, message: "" }), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  useEffect(() => {
    if (withdrawFeedback.type) {
      const timer = setTimeout(() => setWithdrawFeedback({ type: null, message: "" }), 5000);
      return () => clearTimeout(timer);
    }
  }, [withdrawFeedback]);

  // Labels for each deposit step
  const getDepositStepLabel = (step: DepositStep) => {
    switch (step) {
      case "preparing":
        return "Preparing transaction...";
      case "signing":
        return "Waiting for signature...";
      case "confirming":
        return "Confirming on blockchain...";
      case "done":
        return "Complete!";
      default:
        return "Deposit";
    }
  };

  // --- DEPOSIT ---
  const handleDeposit = async () => {
    if (!publicKey) return;

    // Validations
    const numAmount = Number(amount);
    if (numAmount <= 0) {
      setFeedback({ type: "error", message: "Enter a valid amount." });
      return;
    }
    if (numAmount > publicBalance) {
      setFeedback({
        type: "error",
        message: `Insufficient balance. You have ${publicBalance.toFixed(4)} ${selectedToken.symbol}.`
      });
      return;
    }

    setLoading(true);
    setFeedback({ type: null, message: "" });
    setDepositStep("preparing");

    try {
      const client = new ShadowWireClient({ debug: true });

      // Check SDK minimum amount for this token
      const minimumAmount = client.getMinimumAmount(selectedToken.symbol as SdkTokenType);
      console.log("[Deposit] SDK minimum for", selectedToken.symbol, ":", minimumAmount);

      if (numAmount < minimumAmount) {
        setFeedback({
          type: "error",
          message: `Minimum deposit is ${minimumAmount} ${selectedToken.symbol}`
        });
        setLoading(false);
        setDepositStep("idle");
        return;
      }

      // According to docs, deposit expects amount in smallest units
      // For SOL: just wallet + amount
      // For SPL tokens: wallet + amount + token_mint (mint address)
      const amountInSmallestUnit = Math.floor(numAmount * Math.pow(10, selectedToken.decimals));
      const isSOL = selectedToken.symbol === "SOL";

      console.log("[Deposit] Payload:", {
        wallet: publicKey.toBase58(),
        amount: amountInSmallestUnit,
        token_mint: isSOL ? "(native SOL)" : selectedToken.mintAddress,
        originalAmount: numAmount,
        decimals: selectedToken.decimals
      });

      // Build deposit params - only include token_mint for SPL tokens
      const depositParams: any = {
        wallet: publicKey.toBase58(),
        amount: amountInSmallestUnit
      };

      if (!isSOL) {
        depositParams.token_mint = selectedToken.mintAddress;
      }

      const result = await client.deposit(depositParams);

      console.log("[Deposit] SDK Response:", result);

      if (result.unsigned_tx_base64) {
        setDepositStep("signing");
        const txBuffer = Buffer.from(result.unsigned_tx_base64, "base64");
        const transaction = Transaction.from(txBuffer);

        console.log("[Deposit] Sending transaction...");
        console.log(
          "[Deposit] Wallet SOL balance for fees:",
          (await connection.getBalance(publicKey)) / LAMPORTS_PER_SOL
        );

        try {
          const signature = await sendTransaction(transaction, connection);
          console.log("[Deposit] Transaction sent:", signature);
          console.log("[Deposit] View on Solscan: https://solscan.io/tx/" + signature);

          setDepositStep("confirming");
          const confirmation = await connection.confirmTransaction(signature, "confirmed");

          // Check if transaction actually succeeded
          if (confirmation.value.err) {
            console.error("[Deposit] Transaction failed on-chain:", confirmation.value.err);
            throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
          }

          // Double-check by fetching transaction status
          const txDetails = await connection.getTransaction(signature, { commitment: "confirmed" });
          if (txDetails?.meta?.err) {
            console.error("[Deposit] Transaction error details:", txDetails.meta.err);
            throw new Error(`Transaction reverted: ${JSON.stringify(txDetails.meta.err)}`);
          }

          console.log("[Deposit] Transaction confirmed successfully!");

          setDepositStep("done");
          setFeedback({
            type: "success",
            message: `✅ Deposit of ${amount} ${selectedToken.symbol} confirmed!`
          });
          setAmount("");
          onUpdateBalance();
          fetchPublicBalance(); // Update public balance
        } catch (sendError: any) {
          console.error("[Deposit] Send/confirm error:", sendError);
          throw new Error(sendError.message || "Failed to send transaction. Check your SOL balance for fees.");
        }
      } else {
        throw new Error("SDK did not return a transaction to sign.");
      }
    } catch (error: any) {
      setFeedback({
        type: "error",
        message: error.message || "Deposit failed. Try again."
      });
    } finally {
      setLoading(false);
      setTimeout(() => setDepositStep("idle"), 2000);
    }
  };

  // --- WITHDRAW ---
  const handleWithdraw = async () => {
    if (!publicKey || privateBalance <= 0) return;

    const feePercentage = getTokenFeePercentage(selectedToken.symbol);
    const maxWithdraw = privateBalance * (1 - feePercentage);

    setWithdrawLoading(true);
    setWithdrawFeedback({ type: null, message: "" });

    try {
      const client = new ShadowWireClient({ debug: true });

      // For SOL: just wallet + amount
      // For SPL tokens: wallet + amount + token_mint (mint address)
      const amountInSmallestUnit = Math.floor(maxWithdraw * Math.pow(10, selectedToken.decimals));
      const isSOL = selectedToken.symbol === "SOL";

      console.log("[Withdraw] Payload:", {
        wallet: publicKey.toBase58(),
        amount: amountInSmallestUnit,
        token_mint: isSOL ? "(native SOL)" : selectedToken.mintAddress,
        originalAmount: maxWithdraw
      });

      // Build withdraw params - only include token_mint for SPL tokens
      const withdrawParams: any = {
        wallet: publicKey.toBase58(),
        amount: amountInSmallestUnit
      };

      if (!isSOL) {
        withdrawParams.token_mint = selectedToken.mintAddress;
      }

      const result = await client.withdraw(withdrawParams);

      console.log("[Withdraw] SDK Response:", result);

      if (result.unsigned_tx_base64) {
        const txBuffer = Buffer.from(result.unsigned_tx_base64, "base64");
        const transaction = Transaction.from(txBuffer);
        const signature = await sendTransaction(transaction, connection);
        await connection.confirmTransaction(signature, "confirmed");

        setWithdrawFeedback({
          type: "success",
          message: `✅ Withdrawal of ~${maxWithdraw.toFixed(4)} ${selectedToken.symbol} completed!`
        });
        onUpdateBalance();
        fetchPublicBalance();
      }
    } catch (e: any) {
      setWithdrawFeedback({
        type: "error",
        message: e.message || "Withdrawal error. Try again."
      });
    } finally {
      setWithdrawLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-lg mx-auto">
      {/* Educational Card */}
      <div className="bg-blue-900/10 border border-blue-500/20 p-4 rounded-xl">
        <h3 className="text-blue-400 font-bold text-sm mb-2 flex items-center gap-2">
          <ArrowDownToLine size={16} />
          Private Vault
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed">
          To ensure anonymity, your funds need to enter the Shielded Pool. From here, no one knows who sends the money.
        </p>
      </div>

      <div className="space-y-4">
        {/* Deposit Input */}
        <div className="p-4 bg-gray-900 rounded-xl border border-gray-700">
          <div className="flex justify-between items-center mb-3">
            <label className="text-xs text-gray-500 uppercase font-bold">Add Funds ({selectedToken.symbol})</label>

            {/* Public Wallet Balance */}
            <div className="flex items-center gap-2 text-xs">
              <Wallet size={12} className="text-gray-500" />
              <span className="text-gray-500">Available:</span>
              {loadingBalance ? (
                <Loader2 size={12} className="animate-spin text-gray-400" />
              ) : (
                <button
                  onClick={() => setAmount(publicBalance.toFixed(selectedToken.decimals))}
                  className="text-purple-400 hover:text-purple-300 font-mono font-bold transition-colors"
                  title="Click to use maximum"
                >
                  {publicBalance.toFixed(4)} {selectedToken.symbol}
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                <Image
                  src={selectedToken.icon}
                  alt={selectedToken.symbol}
                  width={20}
                  height={20}
                  className="rounded-full"
                />
              </div>
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={loading}
                className="flex-1 bg-black border border-gray-700 pl-10 pr-3 h-12 rounded-lg text-white focus:border-purple-500 outline-none disabled:opacity-50"
              />
            </div>
            <Button
              onClick={handleDeposit}
              disabled={loading || !amount || Number(amount) <= 0}
              className={`px-6 h-12 rounded-lg font-bold text-sm transition-all min-w-30 ${
                depositStep === "done" ? "bg-green-600 hover:bg-green-600" : "bg-gray-700 hover:bg-gray-600"
              } text-white disabled:opacity-50`}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-xs">{getDepositStepLabel(depositStep)}</span>
                </span>
              ) : depositStep === "done" ? (
                <span className="flex items-center gap-2">
                  <CheckCircle size={16} />
                  Done!
                </span>
              ) : (
                "Deposit"
              )}
            </Button>
          </div>

          {/* Deposit Feedback */}
          {feedback.type && (
            <div
              className={`mt-3 p-3 rounded-lg flex items-start gap-2 text-sm animate-in fade-in slide-in-from-top-1 ${
                feedback.type === "success"
                  ? "bg-green-900/20 border border-green-500/30 text-green-400"
                  : "bg-red-900/20 border border-red-500/30 text-red-400"
              }`}
            >
              {feedback.type === "success" ? (
                <CheckCircle size={16} className="shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Vertical stepper during loading */}
          {loading && depositStep !== "idle" && (
            <div className="mt-3 p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
              <DepositStepper currentStep={depositStep} />
            </div>
          )}
        </div>

        {/* Withdraw Button */}
        {privateBalance > 0 && (
          <div className="p-4 bg-gray-900 rounded-xl border border-gray-700">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-sm text-gray-300">Withdraw all private balance</span>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  ~{(privateBalance * (1 - getTokenFeePercentage(selectedToken.symbol))).toFixed(4)}{" "}
                  {selectedToken.symbol} (after fee)
                </p>
              </div>
              <Button
                onClick={handleWithdraw}
                disabled={withdrawLoading}
                variant={"link"}
                className="text-red-400 hover:text-red-300 text-sm font-bold flex items-center gap-2"
              >
                {withdrawLoading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Withdrawing...
                  </>
                ) : (
                  "Withdraw All"
                )}
              </Button>
            </div>

            {/* Withdraw Feedback */}
            {withdrawFeedback.type && (
              <div
                className={`mt-3 p-3 rounded-lg flex items-start gap-2 text-sm animate-in fade-in slide-in-from-top-1 ${
                  withdrawFeedback.type === "success"
                    ? "bg-green-900/20 border border-green-500/30 text-green-400"
                    : "bg-red-900/20 border border-red-500/30 text-red-400"
                }`}
              >
                {withdrawFeedback.type === "success" ? (
                  <CheckCircle size={16} className="shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                )}
                <span>{withdrawFeedback.message}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
