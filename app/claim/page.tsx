/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState } from "react";
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

const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((mod) => mod.WalletMultiButton),
  { ssr: false }
);

const FEE_BUFFER = 5000;

export default function ClaimPage() {
  const searchParams = useSearchParams();
  const { connection } = useConnection();
  const { publicKey } = useWallet();

  const tokenSymbol = searchParams.get("t") || "SOL";
  const amountDisplay = searchParams.get("a") || "---";

  // Busca info do token para exibir ícone
  const tokenInfo: TokenOption | undefined = SUPPORTED_TOKENS.find((t) => t.symbol === tokenSymbol);

  const [status, setStatus] = useState<"idle" | "checking" | "claiming" | "success" | "error">("checking");
  const [txHash, setTxHash] = useState("");
  const [tempKeypair, setTempKeypair] = useState<Keypair | null>(null);

  const [steps, setSteps] = useState([
    { id: "validate", label: "Validando Link", status: "pending" as any },
    { id: "range", label: "Verificando Compliance", status: "pending" as any },
    { id: "transfer", label: "Transferência Gasless", status: "pending" as any }
  ]);

  const updateStep = (id: string, status: "loading" | "success" | "error") => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  };

  // 1. LER O HASH FRAGMENT AO CARREGAR
  useEffect(() => {
    const loadSecret = async () => {
      try {
        // Pega o hash da URL (ex: #5Ks...)
        const hash = window.location.hash.slice(1);
        if (!hash) throw new Error("Link incompleto");

        const secretKey = bs58.decode(hash);
        const keypair = Keypair.fromSecretKey(secretKey);
        setTempKeypair(keypair);

        // Verifica se a carteira temporária ainda tem SOL (para pagar gás)
        const balance = await connection.getBalance(keypair.publicKey);
        if (balance < FEE_BUFFER) {
          setStatus("error");
          return;
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
  }, [connection]);

  const handleClaim = async () => {
    if (!publicKey || !tempKeypair) return alert("Conecte carteira ou link inválido");

    setStatus("claiming");

    try {
      // 2. Compliance Check
      updateStep("range", "loading");
      const rangeRes = await fetch("/api/compliance", {
        method: "POST",
        body: JSON.stringify({ address: publicKey.toBase58() })
      });
      const compliance = await rangeRes.json();
      if (!compliance.allowed) throw new Error("Compliance Blocked");
      updateStep("range", "success");

      // 3. Montar Transação Gasless
      updateStep("transfer", "loading");
      const transaction = new Transaction();

      if (tokenSymbol === "SOL") {
        // --- SOL TRANSFER ---
        const balance = await connection.getBalance(tempKeypair.publicKey);
        const amountToSend = balance - FEE_BUFFER; // Deixa um pouco pra taxa

        transaction.add(
          SystemProgram.transfer({
            fromPubkey: tempKeypair.publicKey,
            toPubkey: publicKey,
            lamports: amountToSend
          })
        );
      } else {
        // --- SPL TOKEN TRANSFER ---
        const tokenInfo = SUPPORTED_TOKENS.find((t) => t.symbol === tokenSymbol);
        if (!tokenInfo) throw new Error("Token desconhecido");
        const mint = new PublicKey(tokenInfo.mintAddress);

        // Endereços ATA
        const tempAta = await getAssociatedTokenAddress(mint, tempKeypair.publicKey);
        const receiverAta = await getAssociatedTokenAddress(mint, publicKey);

        // A. Verifica se Receiver tem conta. Se não, CRIA (TempWallet paga)
        try {
          await getAccount(connection, receiverAta);
        } catch {
          transaction.add(
            createAssociatedTokenAccountInstruction(
              tempKeypair.publicKey, // Payer (TempWallet paga o Rent!)
              receiverAta,
              publicKey,
              mint
            )
          );
        }

        // B. Transfere o Token
        const tokenAccount = await getAccount(connection, tempAta);
        transaction.add(
          createTransferInstruction(
            tempAta,
            receiverAta,
            tempKeypair.publicKey, // Owner (TempWallet assina)
            tokenAccount.amount
          )
        );
      }

      // 4. CONFIGURAÇÃO DE GASLESS
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      transaction.feePayer = tempKeypair.publicKey; // <--- O PULO DO GATO

      // 5. ASSINATURA (Apenas TempWallet assina, Receiver só assiste)
      transaction.sign(tempKeypair);

      const signature = await connection.sendRawTransaction(transaction.serialize());
      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight });

      updateStep("transfer", "success");
      setTxHash(signature);
      setStatus("success");
    } catch (e: any) {
      console.error(e);
      updateStep("transfer", "error");
      setStatus("error");
      alert(e.message);
    }
  };

  // --- UI RENDER ---
  return (
    <div className="min-h-screen bg-black flex flex-col items-center p-4">
      {/* Header com botão de conectar */}
      <div className="w-full max-w-md flex justify-between items-center mb-8 pt-4">
        <Link href="/" className="text-purple-400 hover:text-purple-300 text-sm font-bold flex items-center gap-2">
          👻 Vanta Protocol
        </Link>
        <WalletMultiButton style={{ backgroundColor: "transparent", height: "40px", fontSize: "12px" }} />
      </div>

      <div className="max-w-md w-full bg-gray-900 p-8 rounded-2xl border border-gray-800 text-center relative overflow-hidden">
        {/* Status Visual */}
        <div className="text-6xl mb-4 flex justify-center">
          {status === "success" ? "🎉" : status === "error" ? "❌" : "🎁"}
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">
          {status === "success" ? "Resgate Concluído!" : "Vanta Link Recebido"}
        </h1>

        {status !== "error" && (
          <div className="bg-gray-800/50 p-5 rounded-xl mb-6 border border-gray-700">
            <p className="text-[10px] text-gray-500 uppercase font-bold mb-3">Valor</p>
            <div className="flex items-center justify-center gap-3">
              {tokenInfo?.icon && (
                <Image src={tokenInfo.icon} alt={tokenSymbol} width={40} height={40} className="rounded-full" />
              )}
              <span className="text-3xl font-bold text-white">{amountDisplay}</span>
              <span className="text-xl text-gray-400 font-medium">{tokenSymbol}</span>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="bg-red-900/20 p-4 rounded-xl mb-6 text-red-400 text-sm">Link inválido ou já resgatado.</div>
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
            className="w-full py-4 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-all disabled:opacity-50"
          >
            {!publicKey ? "Conecte a Carteira" : status === "claiming" ? "Processando..." : "Resgatar (Gasless)"}
          </button>
        )}

        <div className="mt-8 text-left">
          <ProcessStatus steps={steps} />
        </div>
      </div>
    </div>
  );
}
