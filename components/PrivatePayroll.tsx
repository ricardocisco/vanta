/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { Buffer } from "buffer";
import { useState, useEffect } from "react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { ShadowWireClient } from "@radr/shadowwire";
import { ComplianceBadge } from "./ui/ComplianceBadge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { PrivacyEducation } from "./PrivacyEducation";
import { ProcessStatus } from "./ProcessStatus";
import { TokenOption } from "@/lib/tokens"; // Ajuste import

// Props recebidas do Pai (ShadowTerminal)
interface PrivatePayrollProps {
  selectedToken: TokenOption;
  privateBalance: number;
  onSuccess: () => void; // Para atualizar saldo após envio
}

// Tipo compatível com ProcessStatus
type ProcessStep = { id: string; label: string; status: "pending" | "loading" | "success" | "error"; detail?: string };

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
        label: match[1] === "TX1" ? "Depósito no Vault" : "Transferência Privada",
        hash: match[2]
      }));
    }

    // Fallback: se não for o formato esperado, retorna como única tx
    return [{ label: "Transação", hash: raw }];
  };

  // Steps Visuais - Usando formato compatível com ProcessStatus
  const [complianceStatus, setComplianceStatus] = useState<"idle" | "loading" | "safe" | "risk">("idle");
  const [processSteps, setProcessSteps] = useState<ProcessStep[]>([
    { id: "compliance", label: "Validação Range", status: "pending" },
    { id: "zkproof", label: "Prova ZK (Radr)", status: "pending" },
    { id: "relayer", label: "Relayer (Helius)", status: "pending" }
  ]);

  // Cálculo de Taxa Estimada
  useEffect(() => {
    const calcFee = () => {
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        setFeeEstimate("0");
        return;
      }
      const feePercentage = parseFloat(selectedToken.fee.replace("%", "")) / 100;
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

  const handlePay = async () => {
    setFormError(null);
    if (!connected || !publicKey || !signMessage) return setFormError("Conecte a carteira.");
    if (!recipient) return setFormError("Informe o endereço.");
    try {
      new PublicKey(recipient);
    } catch {
      return setFormError("Endereço inválido.");
    }
    if (isNaN(Number(amount)) || Number(amount) <= 0) return setFormError("Valor inválido.");

    setLoading(true);
    setProcessSteps([
      { id: "compliance", label: "Validação Range", status: "loading" },
      { id: "zkproof", label: "Prova ZK (Radr)", status: "pending" },
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
        throw new Error(`Compliance Block: ${compliance.reason}`);
      }
      setComplianceStatus("safe");
      updateStep(0, "success");

      // 2. Transfer
      updateStep(1, "loading");
      const client = new ShadowWireClient();

      // SDK transfer() espera valor em unidades normais (ex: 0.5 SOL, não lamports)
      const amountToSend = Number(amount);

      const result = await client.transfer({
        sender: publicKey.toBase58(),
        recipient: recipient,
        amount: amountToSend,
        token: selectedToken.symbol as any,
        type: "external",
        wallet: { signMessage }
      });

      updateStep(1, "success");
      updateStep(2, "loading");

      if (result.unsigned_tx_base64) {
        const txBuffer = Buffer.from(result.unsigned_tx_base64, "base64");
        const transaction = Transaction.from(txBuffer);
        const signature = await sendTransaction(transaction, connection);
        await connection.confirmTransaction(signature, "confirmed");
        updateStep(2, "success");
        onSuccess(); // Atualiza saldo pai
      } else if (result.success && result.tx_signature) {
        console.log("Relayer Success:", result.tx_signature);
        updateStep(2, "success");

        // Parseia as múltiplas transações
        const txs = parseTransactionSignatures(result.tx_signature);
        setResultTxs(txs);
        setAmount("");
        onSuccess(); // Atualiza saldo pai
      } else {
        throw new Error(result.error || "Erro desconhecido.");
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
      <div className="flex-1 space-y-5">
        {/* Input Destinatário */}
        <div>
          <Label className="text-xs text-gray-500 uppercase font-bold">Destinatário</Label>
          <Input
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="Endereço Solana..."
            className="w-full mt-2 bg-gray-900 border border-gray-700 p-3 h-11 rounded text-white focus:border-purple-500 font-mono text-sm"
          />
          <div className="mt-2 h-6">
            <ComplianceBadge status={complianceStatus} />
          </div>
        </div>

        {/* Input Valor */}
        <div>
          <Label className="text-xs text-gray-500 uppercase font-bold flex justify-between">
            <span>Valor ({selectedToken.symbol})</span>
            <span className="text-gray-400">Disp: {(privateBalance - Number(feeEstimate)).toFixed(4)}</span>
          </Label>
          <div className="relative mt-2">
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 p-3 h-11 rounded text-white focus:border-purple-500"
            />
            <Button
              onClick={() => {
                const feePct = parseFloat(selectedToken.fee.replace("%", "")) / 100;
                const max = privateBalance / (1 + feePct);
                setAmount(max.toFixed(selectedToken.decimals));
              }}
              className="absolute right-3 top-1 text-xs bg-purple-900/50 px-2 py-1 rounded text-purple-300 font-bold hover:bg-purple-900"
            >
              MAX
            </Button>
          </div>
          <p className="text-[10px] text-gray-500 mt-1">
            Taxa: ~{feeEstimate} {selectedToken.symbol}
          </p>
        </div>

        <Button
          onClick={handlePay}
          disabled={loading || Number(amount) <= 0}
          className="w-full py-6 bg-linear-to-r from-purple-600 to-indigo-600 hover:brightness-110 text-white rounded-lg font-bold shadow-lg"
        >
          {loading ? "Processando..." : "💸 Enviar Pagamento Seguro"}
        </Button>

        {formError && (
          <div className="p-3 bg-red-900/20 border border-red-500/30 rounded text-center text-red-400 text-xs font-bold">
            {formError}
          </div>
        )}

        <PrivacyEducation sender={publicKey?.toBase58()} />
      </div>

      {/* Coluna Direita: Status usando ProcessStatus unificado */}
      <div className="w-full md:w-1/3 md:border-l border-gray-800 md:pl-6 pt-6 md:pt-0">
        <ProcessStatus steps={processSteps} title="Progresso" />

        {resultTxs.length > 0 && (
          <div className="mt-6 p-4 bg-green-900/10 border border-green-500/20 rounded-lg">
            <p className="text-[10px] text-green-500 font-bold uppercase text-center mb-3">
              ✅ Transferência Concluída
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
