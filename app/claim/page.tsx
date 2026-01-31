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
import { Gift, PartyPopper, ShieldX } from "lucide-react";

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
  const [complianceError, setComplianceError] = useState<string | null>(null);

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
          `🚫 Carteira Bloqueada | Score: ${compliance.riskScore ?? "N/A"}/10` +
            (hops !== undefined ? ` | Hops: ${hops}` : "") +
            `\n${riskMessage}` +
            (category ? `\nCategoria: ${category}` : "")
        );
        setStatus("error");
        return; // Para o fluxo sem throw
      }
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
      // Só marca transfer como erro se não for erro de compliance (já tratado)
      if (!complianceError) {
        updateStep("transfer", "error");
      }
      setStatus("error");
    }
  };

  // --- UI RENDER ---
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center p-4">
      {/* Header com botão de conectar */}
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
          {status === "success" ? "Resgate Concluído!" : "Vanta Link Recebido"}
        </h1>

        {status !== "error" && (
          <div className="bg-gray-800/50 p-5 rounded-xl mb-6 border border-gray-700">
            <p className="text-[10px] text-gray-500 uppercase font-bold mb-2">Valor Embrulhado</p>
            <div className="flex items-center gap-3">
              {tokenInfo?.icon && (
                <Image src={tokenInfo.icon} alt={tokenSymbol} width={40} height={40} className="rounded-full" />
              )}
              <div className="flex items-center w-full justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-xl font-bold text-white">{amountDisplay}</span>
                  <span className="text-md text-gray-400 font-medium">{tokenSymbol}</span>
                </div>
                <span className="text-lg text-gray-400 font-medium">{tokenSymbol}</span>
              </div>
            </div>
          </div>
        )}

        {status === "error" && complianceError && (
          <div className="bg-red-900/30 border border-red-500/50 p-4 rounded-xl mb-6 text-left">
            <p className="text-red-400 text-sm font-medium whitespace-pre-line">{complianceError}</p>
            <p className="text-gray-500 text-xs mt-2">
              Esta carteira está em uma lista de risco e não pode receber fundos.
            </p>
          </div>
        )}

        {status === "error" && !complianceError && (
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
            className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-all disabled:opacity-50"
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
