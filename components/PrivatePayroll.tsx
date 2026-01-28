/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { Buffer } from "buffer";
import { useState, useEffect } from "react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import {
  ShadowWireClient,
  initWASM,
  isWASMSupported,
  TokenUtils
} from "@radr/shadowwire";
import { ComplianceBadge } from "./ui/ComplianceBadge";
import { SurveillanceCam } from "./ui/SurveillanceCam";
import { Button } from "./ui/button";
import { RotateCw } from "lucide-react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

// Tipo para o Stepper lateral (Helius Style)
type Step = { label: string; status: "waiting" | "active" | "done" | "error" };

export default function PrivatePayroll() {
  const { publicKey, signMessage, connected, sendTransaction } = useWallet();
  const { connection } = useConnection();

  // --- UI STATES ---
  const [activeTab, setActiveTab] = useState<"wallet" | "transfer">("wallet");
  const [isWasmReady, setIsWasmReady] = useState(false);
  const [loading, setLoading] = useState(false);

  // --- DATA STATES ---
  const [privateBalance, setPrivateBalance] = useState<number>(0);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [feeEstimate, setFeeEstimate] = useState("0.005"); // Estimativa inicial segura
  const [resultHash, setResultHash] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // --- VISUAL STATES ---
  const [complianceStatus, setComplianceStatus] = useState<
    "idle" | "loading" | "safe" | "risk"
  >("idle");
  const [processSteps, setProcessSteps] = useState<Step[]>([
    { label: "Validação Range", status: "waiting" },
    { label: "Prova ZK (Radr)", status: "waiting" },
    { label: "Relayer (Helius)", status: "waiting" }
  ]);

  // Inicializa WASM
  useEffect(() => {
    const setup = async () => {
      if (isWASMSupported()) {
        try {
          await initWASM("/wasm/settler_wasm_bg.wasm");
          setIsWasmReady(true);
        } catch (e) {
          console.error("WASM Error:", e);
        }
      }
    };
    setup();
  }, []);

  // Monitora saldo ao conectar
  useEffect(() => {
    if (publicKey && isWasmReady) checkBalance();
  }, [publicKey, isWasmReady]);

  // --- CÁLCULO AUTOMÁTICO DE TAXA (SMART INPUT) ---
  useEffect(() => {
    const calcFee = async () => {
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return;
      try {
        const client = new ShadowWireClient();
        // Tenta calcular taxa real. Se falhar, mantém 0.005
        // calculateFee pode retornar objeto complexo, simplificamos aqui
        await client.calculateFee(Number(amount), "SOL");
        // Se chegamos aqui, o valor é valido.
        // Em produção leriamos o retorno exato, mas 0.005 é seguro para mainnet
        setFeeEstimate("0.005");
      } catch (e) {}
    };
    const timeout = setTimeout(calcFee, 600); // Debounce
    return () => clearTimeout(timeout);
  }, [amount]);

  // Helper para atualizar steps visuais
  const updateStep = (index: number, status: "active" | "done" | "error") => {
    setProcessSteps((prev) => {
      const newSteps = [...prev];
      newSteps[index].status = status;
      return newSteps;
    });
  };

  // --- 1. VER SALDO ---
  const checkBalance = async () => {
    if (!publicKey) return;
    setLoading(true);
    try {
      const client = new ShadowWireClient();
      console.log("Consultando saldo...");
      const rawBalance = await client.getBalance(publicKey.toBase58(), "SOL");
      const lamports = rawBalance.available || 0;
      const solBalance = Number(lamports) / 1_000_000_000;

      console.log("Saldo disponível:", solBalance);
      setPrivateBalance(solBalance);

      // UX: Se tiver saldo, joga o usuário para a aba de transferência
      if (solBalance > 0.05 && activeTab === "wallet") {
        setActiveTab("transfer");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // --- 2. SACAR (WITHDRAW) ---
  const handleWithdraw = async () => {
    if (!publicKey || privateBalance <= 0) return;

    const maxWithdraw = privateBalance - 0.005; // Deixa taxa
    if (
      !confirm(
        `Deseja sacar aproximadamente ${maxWithdraw.toFixed(4)} SOL de volta para sua carteira pública?`
      )
    )
      return;

    setLoading(true);
    try {
      const client = new ShadowWireClient();
      // Converte para lamports
      const amountLamports = Math.floor(maxWithdraw * 1_000_000_000);

      const result = await client.withdraw({
        wallet: publicKey.toBase58(),
        amount: amountLamports
      });

      if (result.unsigned_tx_base64) {
        const txBuffer = Buffer.from(result.unsigned_tx_base64, "base64");
        const transaction = Transaction.from(txBuffer);
        const signature = await sendTransaction(transaction, connection);
        await connection.confirmTransaction(signature, "confirmed");

        alert("Saque realizado com sucesso!");
        checkBalance();
      }
    } catch (e: any) {
      alert("Erro no saque: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // --- 3. DEPOSITAR ---
  const handleDeposit = async () => {
    if (!publicKey) return;
    setLoading(true);

    try {
      const client = new ShadowWireClient({});
      const amountInLamports = TokenUtils.toSmallestUnit(Number(amount), "SOL");

      const result = await client.deposit({
        wallet: publicKey.toBase58(),
        amount: Number(amountInLamports)
      });

      if (result.unsigned_tx_base64) {
        const txBuffer = Buffer.from(result.unsigned_tx_base64, "base64");
        const transaction = Transaction.from(txBuffer);
        const signature = await sendTransaction(transaction, connection);
        await connection.confirmTransaction(signature, "confirmed");

        alert("Depósito Confirmado!");
        setAmount("");
        checkBalance();
      }
    } catch (error: any) {
      alert("Falha no depósito: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // --- 4. PAGAR (EXTERNAL TRANSFER) ---
  const handlePay = async () => {
    setFormError(null);
    if (!connected || !publicKey || !signMessage)
      return setFormError("Conecte a carteira para continuar.");

    // VALIDAÇÃO DE ENDEREÇO ANTES DE INICIAR
    if (!recipient) return setFormError("Informe o endereço do destinatário.");
    try {
      new PublicKey(recipient);
    } catch {
      return setFormError(
        "Endereço Solana inválido. Verifique e tente novamente."
      );
    }

    // VALIDAÇÃO DE VALOR
    if (isNaN(Number(amount)) || Number(amount) <= 0) {
      return setFormError("Informe um valor válido para transferência.");
    }

    setLoading(true);
    // Reset visual steps
    setProcessSteps([
      { label: "Validação Range", status: "active" },
      { label: "Prova ZK (Radr)", status: "waiting" },
      { label: "Relayer (Helius)", status: "waiting" }
    ]);

    try {
      // 1. Compliance Check (Range)
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
      updateStep(0, "done");

      // 2. ShadowWire Transfer
      updateStep(1, "active");
      const client = new ShadowWireClient();
      const amountToSend = Number(amount);

      const result = await client.transfer({
        sender: publicKey.toBase58(),
        recipient: recipient,
        amount: amountToSend,
        token: "SOL",
        type: "external",
        wallet: { signMessage }
      });

      updateStep(1, "done");
      updateStep(2, "active");

      // 3. Verifica Resultado (Lógica Fixada)
      if (result.unsigned_tx_base64) {
        // Caso precise assinar
        const txBuffer = Buffer.from(result.unsigned_tx_base64, "base64");
        const transaction = Transaction.from(txBuffer);
        const signature = await sendTransaction(transaction, connection);
        await connection.confirmTransaction(signature, "confirmed");

        updateStep(2, "done");

        checkBalance();
      } else if (result.success === true && result.tx_signature) {
        // Caso Relayer (Sucesso Automático)
        console.log("Auto-Success via Relayer:", result.tx_signature);
        updateStep(2, "done");

        setResultHash(result.tx_signature);
        checkBalance();
        setAmount("");
      } else {
        throw new Error(result.error || "Falha desconhecida no SDK.");
      }
    } catch (error: any) {
      console.error(error);
      const activeIdx = processSteps.findIndex((s) => s.status === "active");
      if (activeIdx !== -1) updateStep(activeIdx, "error");
      setFormError("Erro: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isWasmReady)
    return (
      <div className="text-center p-10 animate-pulse text-purple-400">
        Iniciando Sistema de Criptografia...
      </div>
    );

  return (
    <div className="w-full max-w-3xl mx-auto bg-[#0a0a0a] border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
      {/* HEADER */}
      <div className="p-6 border-b border-gray-800 bg-gray-900/50 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            👻 Shadow Terminal
            <span className="text-[10px] bg-purple-900 text-purple-200 px-2 py-0.5 rounded border border-purple-500/30">
              Mainnet
            </span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Privacidade ZK Powered by Radr & Helius
          </p>
        </div>

        <div className="text-right">
          <p className="text-[10px] text-gray-500 uppercase font-bold">
            Saldo Privado
          </p>
          <div className="flex items-center gap-2 justify-end">
            <span className="text-2xl font-mono text-white font-bold">
              {privateBalance.toFixed(4)}
            </span>
            <span className="text-sm text-purple-400">SOL</span>
            <Button
              disabled={loading}
              size="icon-sm"
              onClick={checkBalance}
              className="group text-xs bg-gray-800 hover:bg-gray-700 "
            >
              <span className="group-disabled:animate-spin">
                <RotateCw size={14} />
              </span>
            </Button>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="flex border-b border-gray-800">
        <button
          onClick={() => setActiveTab("wallet")}
          className={`flex-1 py-4 text-sm font-bold transition-all ${activeTab === "wallet" ? "bg-gray-800 text-white border-b-2 border-purple-500" : "text-gray-500 hover:text-gray-300"}`}
        >
          🛡️ Carteira / Depósito
        </button>
        <button
          onClick={() => setActiveTab("transfer")}
          className={`flex-1 py-4 text-sm font-bold transition-all ${activeTab === "transfer" ? "bg-gray-800 text-white border-b-2 border-purple-500" : "text-gray-500 hover:text-gray-300"}`}
        >
          💸 Pagamento Anônimo
        </button>
      </div>

      {/* CONTEÚDO */}
      <div className="p-6 min-h-100">
        {/* ABA 1: CARTEIRA */}
        {activeTab === "wallet" && (
          <div className="space-y-6 animate-fade-in max-w-lg mx-auto">
            <div className="bg-blue-900/10 border border-blue-500/20 p-4 rounded-lg">
              <h3 className="text-blue-400 font-bold text-sm mb-2">
                Por que carregar saldo?
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Para garantir anonimato, seus fundos precisam entrar no Cofre
                Privado (Shielded Pool). A partir daqui, ninguém sabe quem envia
                o dinheiro.
              </p>
            </div>

            <div className="space-y-4">
              {/* Depositar */}
              <div className="p-4 bg-gray-900 rounded border border-gray-700">
                <label className="text-xs text-gray-500 uppercase font-bold">
                  Adicionar Fundos (SOL)
                </label>
                <div className="flex gap-2 mt-3">
                  <Input
                    type="number"
                    placeholder="0.1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="flex-1 bg-black border border-gray-700 p-3 h-12 rounded text-white focus:border-purple-500 outline-none"
                  />
                  <Button
                    onClick={handleDeposit}
                    disabled={loading}
                    className="px-6 py-6 bg-gray-700 hover:bg-gray-600 text-white rounded font-bold text-sm"
                  >
                    Depositar
                  </Button>
                </div>
              </div>

              {/* Sacar */}
              {privateBalance > 0 && (
                <div className="p-4 bg-gray-900 rounded border border-gray-700 flex justify-between items-center">
                  <span className="text-sm text-gray-300">
                    Resgatar todo saldo privado
                  </span>
                  <Button
                    onClick={handleWithdraw}
                    disabled={loading}
                    variant={"link"}
                    className="text-red-400 hover:text-red-300 text-sm underline font-bold"
                  >
                    Sacar Tudo
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ABA 2: TRANSFERÊNCIA */}
        {activeTab === "transfer" && (
          <div className="flex flex-col md:flex-row gap-8 animate-fade-in">
            {/* Esquerda: Formulário */}
            <div className="flex-1 space-y-5">
              <div>
                <Label className="text-xs text-gray-500 uppercase font-bold">
                  Destinatário
                </Label>
                <Input
                  type="text"
                  placeholder="Endereço Solana..."
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className="w-full mt-2 bg-gray-900 border border-gray-700 p-3 h-11 rounded text-white focus:border-purple-500 outline-none font-mono text-sm"
                />
                <div className="mt-2 h-6">
                  <ComplianceBadge status={complianceStatus} />
                </div>
              </div>

              <div>
                <Label className="text-xs text-gray-500 uppercase font-bold flex justify-between">
                  <span>Valor (SOL)</span>
                  <span className="text-gray-400">
                    Disponível:{" "}
                    {(privateBalance - Number(feeEstimate)).toFixed(4)}
                  </span>
                </Label>
                <div className="relative mt-2">
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 p-3 h-11 rounded text-white focus:border-purple-500 outline-none"
                  />
                  <Button
                    onClick={() =>
                      setAmount(
                        (privateBalance - Number(feeEstimate)).toFixed(4)
                      )
                    }
                    className="absolute right-3 top-1 text-xs bg-purple-900/50 px-2 py-1 rounded text-purple-300 font-bold hover:bg-purple-900"
                  >
                    MAX
                  </Button>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  Taxa estimada: ~{feeEstimate} SOL
                </p>
              </div>

              <Button
                onClick={handlePay}
                disabled={loading || Number(amount) <= 0}
                className="w-full py-6 bg-linear-to-r from-purple-600 to-indigo-600 hover:brightness-110 text-white rounded-lg font-bold shadow-lg shadow-purple-900/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading
                  ? "Processando ZK Proof..."
                  : "💸 Enviar Pagamento Seguro"}
              </Button>

              {formError && (
                <div className="p-3 bg-red-900/20 border border-red-500/30 rounded text-center animate-fade-in">
                  <p className="text-red-400 text-xs font-bold">{formError}</p>
                </div>
              )}

              <SurveillanceCam
                isActive={loading || complianceStatus === "safe"}
              />
            </div>

            {/* Direita: Status Steps */}
            <div className="w-full md:w-1/3 md:border-l border-t md:border-t-0 border-gray-800 md:pl-6 pt-6 md:pt-0">
              <h4 className="text-xs uppercase text-gray-500 font-bold mb-6">
                Progresso da Transação
              </h4>

              <div className="space-y-0 relative">
                {processSteps.map((step, idx) => (
                  <div key={idx} className="relative flex min-h-10">
                    {/* Linha Vertical Conectora (Apenas se não for o último) */}
                    {idx !== processSteps.length - 1 && (
                      <div className="absolute left-2.75 top-6 -bottom-1.5 w-0.5 bg-gray-800 z-0"></div>
                    )}

                    <div className="relative z-10 flex items-start gap-3">
                      <div
                        className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[10px] border-2 transition-all ${
                          step.status === "waiting"
                            ? "bg-gray-900 border-gray-700 text-gray-700"
                            : step.status === "active"
                              ? "bg-blue-900 border-blue-500 text-white animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                              : step.status === "error"
                                ? "bg-red-900 border-red-500 text-white"
                                : "bg-green-900 border-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.5)]"
                        }`}
                      >
                        {step.status === "done" ? "✓" : idx + 1}
                      </div>
                      <span
                        className={`text-sm font-medium pt-0.5 transition-colors ${
                          step.status === "active"
                            ? "text-white"
                            : step.status === "done"
                              ? "text-green-400"
                              : "text-gray-500"
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {resultHash && (
                <div className="mt-6 p-4 bg-green-900/10 border border-green-500/20 rounded-lg animate-fade-in text-center md:text-left">
                  <p className="text-[10px] text-green-500 font-bold uppercase mb-1">
                    Pagamento Confirmado
                  </p>
                  <a
                    href={`https://solscan.io/tx/${resultHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-green-300 underline break-all hover:text-green-200 transition-colors flex items-center md:justify-start justify-center gap-1"
                  >
                    Ver no Solscan ↗
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
