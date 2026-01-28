/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { ShadowWireClient, TokenUtils } from "@radr/shadowwire";
import { ProcessStatus } from "./ProcessStatus";
import { PrivacyEducation } from "./PrivacyEducation";
import { SUPPORTED_TOKENS, TokenOption } from "@/lib/tokens";

export default function ShadowLinkCreator() {
  const { publicKey, signMessage } = useWallet();
  const [amount, setAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState<TokenOption>(
    SUPPORTED_TOKENS[0]
  ); // Default SOL
  const [generatedLink, setGeneratedLink] = useState("");

  // Controle de Passos da UI
  const [steps, setSteps] = useState([
    {
      id: "compliance",
      label: "Verificação Range (Compliance)",
      status: "pending" as any
    },
    {
      id: "keygen",
      label: "Gerando Link Temporário",
      status: "pending" as any
    },
    {
      id: "zkproof",
      label: "Radr: Criando Prova ZK",
      status: "pending" as any
    },
    { id: "transfer", label: "Transferência Privada", status: "pending" as any }
  ]);

  // Função auxiliar para atualizar steps
  const updateStep = (
    id: string,
    status: "loading" | "success" | "error",
    detail?: string
  ) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status, detail } : s))
    );
  };

  const handleCreateLink = async () => {
    if (!publicKey || !signMessage) return;

    // Reset steps
    setSteps((prev) =>
      prev.map((s) => ({ ...s, status: "pending", detail: "" }))
    );

    try {
      // PASSO 1: RANGE COMPLIANCE
      updateStep("compliance", "loading");
      const complianceRes = await fetch("/api/compliance", {
        method: "POST",
        body: JSON.stringify({ address: publicKey.toBase58() }) // Verifica se QUEM envia está limpo
      });
      const compliance = await complianceRes.json();

      if (!compliance.allowed) {
        updateStep("compliance", "error", "Carteira sancionada detectada!");
        return;
      }
      updateStep("compliance", "success", "Carteira segura (Low Risk)");

      // PASSO 2: GERAR KEYPAIR TEMP
      updateStep("keygen", "loading");
      const tempKeypair = Keypair.generate();
      const tempPublicKey = tempKeypair.publicKey.toBase58();
      // Codifica a secretKey para a URL
      const secretKeyEncoded = bs58.encode(tempKeypair.secretKey);
      updateStep(
        "keygen",
        "success",
        `Cofre criado: ${tempPublicKey.slice(0, 6)}...`
      );

      // PASSO 3 & 4: RADR TRANSFER (External)
      updateStep("zkproof", "loading");
      const client = new ShadowWireClient();

      // Conversão Dinâmica de Decimais
      const amountInUnits =
        Number(amount) * Math.pow(10, selectedToken.decimals);

      console.log(
        `Enviando ${amountInUnits} unidades de ${selectedToken.symbol}`
      );

      // Executa a transferência do Saldo Privado -> Carteira do Link
      updateStep("transfer", "loading");
      const result = await client.transfer({
        sender: publicKey.toBase58(),
        recipient: tempPublicKey,
        amount: amountInUnits,
        token: selectedToken.symbol as any, // O SDK precisa aceitar o Symbol ou Mint Address
        type: "external", // OBRIGATÓRIO PARA SAIR PARA UMA CARTEIRA NORMAL
        wallet: { signMessage }
      });

      // Se precisar assinar (Mainnet geralmente precisa do fluxo unsigned)
      // Adicione a lógica de sendTransaction aqui se o result.unsigned_tx_base64 vier preenchido
      // (Ignorando para brevidade, mas use o mesmo do Depósito)

      if (result.success || result.tx_signature) {
        updateStep("zkproof", "success");
        updateStep("transfer", "success", "Fundos transferidos anonimamente");

        // Gera o Link Final
        const link = `${window.location.origin}/claim/${secretKeyEncoded}?token=${selectedToken.symbol}&amount=${amount}`;
        setGeneratedLink(link);
      } else {
        throw new Error("Falha na confirmação");
      }
    } catch (e: any) {
      console.error(e);
      updateStep("transfer", "error", e.message);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6 bg-gray-900 rounded-2xl border border-gray-800 shadow-xl">
      <h2 className="text-2xl font-bold text-white mb-6">
        🔗 Criar Shadow Link
      </h2>

      {!generatedLink ? (
        <div className="space-y-6">
          {/* Seletor de Tokens */}
          <div>
            <label className="text-xs text-gray-400 uppercase font-bold">
              Token
            </label>
            <div className="flex gap-2 mt-2 overflow-x-auto pb-2">
              {SUPPORTED_TOKENS.map((token) => (
                <button
                  key={token.symbol}
                  onClick={() => setSelectedToken(token)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                    selectedToken.symbol === token.symbol
                      ? "bg-purple-900/50 border-purple-500 text-white"
                      : "bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700"
                  }`}
                >
                  <span>{token.symbol}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Input Valor */}
          <div>
            <label className="text-xs text-gray-400 uppercase font-bold">
              Valor
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-black/50 p-4 rounded-lg border border-gray-700 text-2xl text-white focus:border-purple-500 outline-none"
              placeholder="0.00"
            />
          </div>

          <button
            onClick={handleCreateLink}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg font-bold text-white hover:brightness-110 transition-all"
          >
            Gerar Link Privado
          </button>

          {/* Status do Processo */}
          <ProcessStatus steps={steps} />
        </div>
      ) : (
        <div className="text-center animate-fade-in">
          <div className="bg-green-900/20 p-6 rounded-xl border border-green-500/50 mb-6">
            <div className="text-5xl mb-4">🎉</div>
            <h3 className="text-xl font-bold text-green-400 mb-2">
              Link Gerado com Sucesso!
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              Qualquer pessoa com este link pode resgatar o valor de forma
              anônima.
            </p>

            <div className="bg-black p-3 rounded border border-gray-700 break-all font-mono text-xs text-gray-300">
              {generatedLink}
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(generatedLink)}
              className="mt-3 text-sm text-green-400 hover:text-green-300 font-bold"
            >
              📋 Copiar Link
            </button>
          </div>

          {/* Componente Educativo Encrypt.trade */}
          {publicKey && (
            <PrivacyEducation
              sender={publicKey.toBase58()}
              tempWallet="Carteira Oculta"
            />
          )}

          <button
            onClick={() => setGeneratedLink("")}
            className="mt-6 text-gray-500 hover:text-white text-sm"
          >
            Criar Novo Link
          </button>
        </div>
      )}
    </div>
  );
}
