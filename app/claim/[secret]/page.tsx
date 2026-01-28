/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  Keypair,
  Transaction,
  SystemProgram,
  PublicKey,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import bs58 from "bs58";
import { ProcessStatus } from "@/components/ProcessStatus";

// Você precisa instalar: npm install @solana/spl-token
// import { createTransferInstruction, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token';

export default function ClaimPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const secretKeyEncoded = params.secret as string;
  const tokenSymbol = searchParams.get("token") || "SOL";
  const amountDisplay = searchParams.get("amount") || "0";

  const [status, setStatus] = useState("idle"); // idle, claiming, success, error
  const [steps, setSteps] = useState([
    { id: "validate", label: "Validando Link", status: "pending" as any },
    {
      id: "range",
      label: "Verificando Sua Carteira (Range)",
      status: "pending" as any
    },
    { id: "transfer", label: "Transferindo Fundos", status: "pending" as any }
  ]);

  const handleClaim = async () => {
    if (!publicKey) return alert("Conecte sua carteira para receber!");

    setStatus("claiming");

    try {
      // 1. Reconstruir a Carteira do Link
      const secretKey = bs58.decode(secretKeyEncoded);
      const tempKeypair = Keypair.fromSecretKey(secretKey);

      // 2. Range Check (No Recebedor)
      setSteps((prev) =>
        prev.map((s) => (s.id === "range" ? { ...s, status: "loading" } : s))
      );
      const rangeRes = await fetch("/api/compliance", {
        method: "POST",
        body: JSON.stringify({ address: publicKey.toBase58() })
      });
      const compliance = await rangeRes.json();
      if (!compliance.allowed)
        throw new Error(
          "Sua carteira foi marcada como risco pela Range Protocol."
        );

      setSteps((prev) =>
        prev.map((s) => (s.id === "range" ? { ...s, status: "success" } : s))
      );

      // 3. Transferência (Claim)
      setSteps((prev) =>
        prev.map((s) => (s.id === "transfer" ? { ...s, status: "loading" } : s))
      );

      const transaction = new Transaction();

      if (tokenSymbol === "SOL") {
        // Pega o saldo total da Temp Wallet e subtrai a taxa
        const balance = await connection.getBalance(tempKeypair.publicKey);
        const fee = 5000; // Taxa estimada
        const amountToSend = balance - fee;

        transaction.add(
          SystemProgram.transfer({
            fromPubkey: tempKeypair.publicKey,
            toPubkey: publicKey,
            lamports: amountToSend
          })
        );
      } else {
        // Lógica para SPL Tokens (USD1, USDC)
        // 1. Get Token Mint
        // 2. Get ATA do TempWallet
        // 3. Get ATA do Receiver (Create if not exists)
        // 4. token.createTransferInstruction(...)
        // Nota: Você precisará de um pouquinho de SOL na TempWallet para pagar o Gás dessa tx.
        // Geralmente o Sender manda SOL + Token na criação, ou você usa um Relayer.
        alert(
          "Para este hackathon, o claim automático de tokens SPL requer gás SOL na carteira temporária."
        );
        return;
      }

      // Quem assina e paga o gás é a TEMP WALLET (pois ela tem o SOL), não o Receiver
      // Isso faz o claim ser "Gasless" para o recebedor!
      const signature = await connection.sendTransaction(transaction, [
        tempKeypair
      ]);

      await connection.confirmTransaction(signature, "confirmed");

      setSteps((prev) =>
        prev.map((s) =>
          s.id === "transfer"
            ? {
                ...s,
                status: "success",
                detail: `Hash: ${signature.slice(0, 8)}...`
              }
            : s
        )
      );
      setStatus("success");
    } catch (e: any) {
      console.error(e);
      setSteps((prev) =>
        prev.map((s) =>
          s.id === "transfer" ? { ...s, status: "error", detail: e.message } : s
        )
      );
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-900 p-8 rounded-2xl border border-gray-800 text-center">
        <div className="text-6xl mb-4">🎁</div>
        <h1 className="text-2xl font-bold text-white mb-2">
          Você recebeu um Shadow Link!
        </h1>
        <p className="text-gray-400 mb-8">
          Alguém te enviou{" "}
          <strong className="text-white">
            {amountDisplay} {tokenSymbol}
          </strong>{" "}
          de forma totalmente privada.
        </p>

        {status === "success" ? (
          <div className="bg-green-500/20 text-green-400 p-4 rounded-xl font-bold">
            Dinheiro na conta! 🎉
          </div>
        ) : (
          <button
            onClick={handleClaim}
            disabled={status === "claiming" || !publicKey}
            className="w-full py-4 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-all disabled:opacity-50"
          >
            {!publicKey
              ? "Conecte a Carteira para Resgatar"
              : status === "claiming"
                ? "Processando..."
                : "Resgatar Agora"}
          </button>
        )}

        <div className="text-left mt-6">
          <ProcessStatus steps={steps} />
        </div>
      </div>
    </div>
  );
}
