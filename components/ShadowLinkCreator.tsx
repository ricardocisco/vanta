/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Keypair, Transaction, SystemProgram } from "@solana/web3.js";
import bs58 from "bs58";
import { ShadowWireClient } from "@radr/shadowwire";
import QRCode from "react-qr-code";
import { ProcessStatus } from "./ProcessStatus";
import { TokenOption } from "@/lib/tokens"; // Ajuste o caminho se necessário
import { AlertCircle, CheckCircle, Copy, Gift, Info } from "lucide-react";

const MIN_AMOUNT_SOL = 0.1;
const GAS_FEE = 0.002;

interface ShadowLinkCreatorProps {
  globalToken: TokenOption; // Recebido do Pai (ShadowTerminal)
  globalBalance: number; // Recebido do Pai
  onSuccess?: () => void;
}

// Função auxiliar para salvar no histórico permanente
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

// Atualiza status de um link no histórico
const updateLinkInHistory = (linkId: number, updates: any) => {
  const history = JSON.parse(localStorage.getItem("vanta_link_history") || "[]");
  const updated = history.map((link: any) => (link.id === linkId ? { ...link, ...updates } : link));
  localStorage.setItem("vanta_link_history", JSON.stringify(updated));
};

// Remove link do histórico (se não completou nenhuma transferência)
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

  // Limpa erro quando digita
  useEffect(() => {
    if (error) setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount]);

  // Controle de Passos
  const [steps, setSteps] = useState([
    { id: "compliance", label: "Verificação Range (Compliance)", status: "pending" as any },
    { id: "keygen", label: "Gerando Chaves Temporárias", status: "pending" as any },
    { id: "zkproof", label: "Radr: Prova de Privacidade", status: "pending" as any },
    { id: "transfer", label: "Transferência para o Link", status: "pending" as any }
  ]);

  const updateStep = (id: string, status: "loading" | "success" | "error", detail?: string) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, status, detail } : s)));
  };

  // --- LÓGICA DE CRIAÇÃO ---
  const handleCreateLink = async () => {
    if (!publicKey || !signMessage) return setError("Conecte sua carteira.");

    const numAmount = Number(amount);

    // --- VALIDAÇÃO 1: MÍNIMO RADR ---
    if (globalToken.symbol === "SOL" && numAmount < MIN_AMOUNT_SOL) {
      return setError(`O valor mínimo permitido pela rede é ${MIN_AMOUNT_SOL} SOL.`);
    }

    // --- VALIDAÇÃO 2: SALDO INSUFICIENTE ---
    // Precisamos ter: Valor do Link + Taxa de Gás (0.002)
    const totalRequired = numAmount + GAS_FEE;
    if (totalRequired > globalBalance) {
      return setError(
        `Saldo insuficiente. Você precisa de ${totalRequired.toFixed(4)} ${globalToken.symbol} (Valor + Gás).`
      );
    }

    // Inicia Processo
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
        throw new Error("Carteira bloqueada por Compliance.");
      }
      updateStep("compliance", "success");

      // 2. Keygen & Link Hash
      updateStep("keygen", "loading");
      const tempKeypair = Keypair.generate();
      const tempPublicKey = tempKeypair.publicKey.toBase58();
      const secretKeyEncoded = bs58.encode(tempKeypair.secretKey);
      const tokenIdentifier = globalToken.symbol === "SOL" ? "SOL" : globalToken.mintAddress;

      // Link seguro com Hash (#)
      const linkUrl = `${window.location.origin}/claim?t=${globalToken.symbol}&a=${amount}#${secretKeyEncoded}`;
      localStorage.setItem("vanta_last_link", linkUrl);

      // ⚠️ SALVA NO HISTÓRICO ANTES DE TRANSFERIR (para recuperação em caso de erro)
      const linkId = saveLinkToHistory({
        secretKey: secretKeyEncoded,
        amount: amount,
        symbol: globalToken.symbol,
        mint: tokenIdentifier,
        decimals: globalToken.decimals,
        status: "pending", // Marca como pendente até completar
        txSignature: null
      });
      updateStep("keygen", "success");

      let transferCompleted = false;

      try {
        // 3. Transferência ZK (Radr) - O Valor Real
        updateStep("zkproof", "loading");
        const client = new ShadowWireClient();

        // SDK transfer() espera valor em unidades normais (ex: 0.5 SOL, não lamports)
        const result = await client.transfer({
          sender: publicKey.toBase58(),
          recipient: tempPublicKey,
          amount: numAmount,
          token: tokenIdentifier,
          type: "external",
          wallet: { signMessage }
        });

        // Lida com assinatura se necessário
        if (result.unsigned_tx_base64) {
          const txBuffer = Buffer.from(result.unsigned_tx_base64, "base64");
          const transaction = Transaction.from(txBuffer);
          const signature = await sendTransaction(transaction, connection);
          await connection.confirmTransaction(signature, "confirmed");
        } else if (!result.success && !result.tx_signature) {
          throw new Error(result.error || "Erro no SDK Radr");
        }

        transferCompleted = true; // Fundos já foram transferidos
        updateStep("zkproof", "success");

        // 4. Gás Público (0.002 SOL)
        // Isso garante que o recebedor possa sacar sem ter SOL na carteira
        updateStep("transfer", "loading", "Adicionando Gás...");
        const gasTx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: tempKeypair.publicKey,
            lamports: GAS_FEE * 1e9 // 0.002 SOL
          })
        );
        const gasSig = await sendTransaction(gasTx, connection);
        await connection.confirmTransaction(gasSig, "confirmed");
        updateStep("transfer", "success");

        // ✅ Tudo ok - Atualiza status para completo
        updateLinkInHistory(linkId, {
          status: "complete",
          txSignature: gasSig
        });
      } catch (innerError: any) {
        // Se deu erro MAS a transferência ZK já foi feita, mantém no histórico para refund
        if (transferCompleted) {
          updateLinkInHistory(linkId, {
            status: "partial", // Fundos na temp wallet, mas sem gás
            error: innerError.message
          });
          throw new Error(
            `Fundos transferidos mas houve erro no gás. Use o Histórico para recuperar. (${innerError.message})`
          );
        } else {
          // Se nem a transferência ZK foi feita, remove do histórico (nada foi perdido)
          removeLinkFromHistory(linkId);
          throw innerError;
        }
      }

      setGeneratedLink(linkUrl);
      if (onSuccess) onSuccess(); // Atualiza saldo pai
      setView("success");
    } catch (e: any) {
      console.error(e);
      updateStep("transfer", "error", e.message);
      // Volta para input após 3s para corrigir erro
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

  // --- TELA 1: INPUT ---
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
            <span className="text-[10px] text-red-400">Sem Saldo</span>
          )}
        </div>

        {/* Input Gigante */}
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
            Disponível: {globalBalance.toFixed(4)} {globalToken.symbol}
          </p>
        </div>

        {/* --- AQUI ESTÁ A CORREÇÃO DA UI DE ERRO --- */}
        {error && (
          <div className="flex items-center gap-2 justify-center mb-6 text-red-400 animate-in fade-in slide-in-from-top-1">
            <AlertCircle size={16} />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {/* Breakdown de Custos (Só mostra se tiver valor válido) */}
        {!error && amount && Number(amount) > 0 && (
          <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800 text-xs space-y-2 mb-6">
            <div className="flex justify-between text-gray-400">
              <span>Valor do Link</span>
              <span className="text-white font-mono">
                {Number(amount).toFixed(4)} {globalToken.symbol}
              </span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span className="flex items-center gap-1">
                <Info size={10} /> Taxa Gasless
              </span>
              <span className="text-yellow-500 font-mono">+{GAS_FEE} SOL</span>
            </div>
            <div className="border-t border-gray-700 pt-2 flex justify-between font-bold">
              <span className="text-gray-300">Total a Debitar</span>
              <span className="text-purple-300 font-mono">
                {(Number(amount) + (globalToken.symbol === "SOL" ? GAS_FEE : 0)).toFixed(4)} {globalToken.symbol}
                {globalToken.symbol !== "SOL" && ` + ${GAS_FEE} SOL`}
              </span>
            </div>
          </div>
        )}

        <button
          onClick={handleCreateLink}
          disabled={Number(amount) <= 0}
          className="w-full py-4 bg-white hover:bg-gray-200 text-black font-bold rounded-2xl text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Gerar Link Privado
        </button>
      </div>
    );
  }

  // --- TELA 2: PROCESSANDO ---
  if (view === "processing") {
    return (
      <div className="max-w-md mx-auto p-6 bg-gray-900 rounded-3xl border border-gray-800 shadow-xl">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-2xl">⚙️</span>
          </div>
          <h3 className="text-white font-bold">Criando Vanta Link...</h3>
          <p className="text-gray-500 text-xs mt-1">Garantindo anonimato via ZK Proofs.</p>
        </div>
        <ProcessStatus steps={steps} />
      </div>
    );
  }

  // --- TELA 3: SUCESSO ---
  return (
    <div className="max-w-md mx-auto p-6 bg-[#0F1115] rounded-3xl border border-gray-800 shadow-2xl text-white animate-fade-in">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-1">Pronto! 🎉</h2>
        <p className="text-gray-400 text-sm mb-6">Fundos embrulhados com sucesso.</p>

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
          <p className="text-[10px] text-gray-500 uppercase font-bold mb-2">Valor Embrulhado</p>
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
          ← Criar Novo Link
        </button>
      </div>
    </div>
  );
}
