/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import { ShadowWireClient, TokenUtils } from "@radr/shadowwire";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { TokenOption } from "@/lib/tokens"; // Ajuste o import conforme seu projeto

interface WalletManagerProps {
  selectedToken: TokenOption;
  privateBalance: number;
  onUpdateBalance: () => void;
}

export default function WalletManager({ selectedToken, privateBalance, onUpdateBalance }: WalletManagerProps) {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  // --- DEPOSITAR ---
  const handleDeposit = async () => {
    if (!publicKey) return;
    setLoading(true);

    try {
      const client = new ShadowWireClient({});
      const amountInSmallestUnit = TokenUtils.toSmallestUnit(Number(amount), selectedToken.symbol);

      const result = await client.deposit({
        wallet: publicKey.toBase58(),
        amount: Number(amountInSmallestUnit),
        token: selectedToken.symbol
      });

      if (result.unsigned_tx_base64) {
        const txBuffer = Buffer.from(result.unsigned_tx_base64, "base64");
        const transaction = Transaction.from(txBuffer);
        const signature = await sendTransaction(transaction, connection);
        await connection.confirmTransaction(signature, "confirmed");

        alert("Depósito Confirmado!");
        setAmount("");
        onUpdateBalance(); // Atualiza saldo no Pai
      }
    } catch (error: any) {
      alert("Falha no depósito: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // --- SACAR ---
  const handleWithdraw = async () => {
    if (!publicKey || privateBalance <= 0) return;

    const feePercentage = parseFloat(selectedToken.fee.replace("%", "")) / 100;
    const maxWithdraw = privateBalance * (1 - feePercentage); // Desconta taxa aproximada

    if (!confirm(`Sacar ~${maxWithdraw.toFixed(4)} ${selectedToken.symbol} para sua carteira pública?`)) return;

    setLoading(true);
    try {
      const client = new ShadowWireClient();
      const amountSmallestUnit = Math.floor(maxWithdraw * Math.pow(10, selectedToken.decimals));

      const result = await client.withdraw({
        wallet: publicKey.toBase58(),
        amount: amountSmallestUnit,
        token: selectedToken.symbol
      });

      if (result.unsigned_tx_base64) {
        const txBuffer = Buffer.from(result.unsigned_tx_base64, "base64");
        const transaction = Transaction.from(txBuffer);
        const signature = await sendTransaction(transaction, connection);
        await connection.confirmTransaction(signature, "confirmed");

        alert("Saque realizado!");
        onUpdateBalance();
      }
    } catch (e: any) {
      alert("Erro no saque: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-lg mx-auto">
      {/* Card Educativo */}
      <div className="bg-blue-900/10 border border-blue-500/20 p-4 rounded-lg">
        <h3 className="text-blue-400 font-bold text-sm mb-2">Cofre Privado</h3>
        <p className="text-xs text-gray-400 leading-relaxed">
          Para garantir anonimato, seus fundos precisam entrar no Shielded Pool. A partir daqui, ninguém sabe quem envia
          o dinheiro.
        </p>
      </div>

      <div className="space-y-4">
        {/* Input de Depósito */}
        <div className="p-4 bg-gray-900 rounded border border-gray-700">
          <label className="text-xs text-gray-500 uppercase font-bold">Adicionar Fundos ({selectedToken.symbol})</label>
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
              disabled={loading || !amount}
              className="px-6 py-6 bg-gray-700 hover:bg-gray-600 text-white rounded font-bold text-sm"
            >
              {loading ? "..." : "Depositar"}
            </Button>
          </div>
        </div>

        {/* Botão de Saque */}
        {privateBalance > 0 && (
          <div className="p-4 bg-gray-900 rounded border border-gray-700 flex justify-between items-center">
            <span className="text-sm text-gray-300">Resgatar todo saldo privado</span>
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
  );
}
