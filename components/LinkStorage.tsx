/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { FolderOpen, Lock, RotateCw, Save, ScrollText } from "lucide-react";

export default function LinkHistory() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [links, setLinks] = useState<any[]>([]);
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const loadLinks = useCallback(async () => {
    const saved = JSON.parse(localStorage.getItem("vanta_link_history") || "[]");
    if (saved.length === 0) {
      setLinks([]);
      return;
    }

    // Sort by date
    saved.sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt));

    // Check on-chain status
    const updatedLinks = await Promise.all(
      saved.map(async (link: any) => {
        try {
          const secret = bs58.decode(link.secretKey);
          const tempKeypair = Keypair.fromSecretKey(secret);
          const balance = await connection.getBalance(tempKeypair.publicKey);

          // If balance > minimum fee, it's active
          const isActive = balance > 0.001 * LAMPORTS_PER_SOL;

          return { ...link, isActive, currentBalance: balance };
        } catch (e) {
          return { ...link, isActive: false, error: true };
        }
      })
    );

    setLinks(updatedLinks);
  }, [connection]);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  const handleExport = () => {
    const dataStr = localStorage.getItem("vanta_link_history");
    if (!dataStr || dataStr === "[]") return alert("No history found.");
    const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);
    const fileName = `vanta_backup_${new Date().toISOString().slice(0, 10)}.json`;
    const link = document.createElement("a");
    link.setAttribute("href", dataUri);
    link.setAttribute("download", fileName);
    link.click();
  };

  const handleImport = (event: any) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (!Array.isArray(imported)) throw new Error();

        const current = JSON.parse(localStorage.getItem("vanta_link_history") || "[]");
        const currentIds = new Set(current.map((l: any) => l.id));
        const newItems = imported.filter((l: any) => !currentIds.has(l.id));

        localStorage.setItem("vanta_link_history", JSON.stringify([...current, ...newItems]));
        alert(`${newItems.length} links restored!`);
        loadLinks();
      } catch (err) {
        alert("Invalid file.");
      }
    };
    reader.readAsText(file);
  };

  // Refund (Cancellation) - Supports SOL and SPL Tokens
  const handleRefund = async (link: any) => {
    if (!publicKey) return alert("Connect your wallet.");
    if (!confirm("Cancel link and refund balance?")) return;

    setLoadingId(link.id);
    try {
      const secret = bs58.decode(link.secretKey);
      const tempKeypair = Keypair.fromSecretKey(secret);
      const balance = await connection.getBalance(tempKeypair.publicKey);
      const fee = 5000;

      if (balance < fee) throw new Error("Insufficient balance for network fee.");

      const transaction = new Transaction();

      // Se for token SPL, precisa transferir o token também
      if (link.symbol !== "SOL" && link.mint) {
        const {
          getAssociatedTokenAddress,
          createAssociatedTokenAccountInstruction,
          createTransferInstruction,
          getAccount
        } = await import("@solana/spl-token");
        const mint = new PublicKey(link.mint);

        // Busca ATA da temp wallet
        const tempAta = await getAssociatedTokenAddress(mint, tempKeypair.publicKey);
        const ownerAta = await getAssociatedTokenAddress(mint, publicKey);

        try {
          const tokenAccount = await getAccount(connection, tempAta);

          if (tokenAccount.amount > BigInt(0)) {
            // Verifica se owner tem ATA, se não cria
            try {
              await getAccount(connection, ownerAta);
            } catch {
              transaction.add(
                createAssociatedTokenAccountInstruction(tempKeypair.publicKey, ownerAta, publicKey, mint)
              );
            }

            // Transfere tokens de volta
            transaction.add(createTransferInstruction(tempAta, ownerAta, tempKeypair.publicKey, tokenAccount.amount));
          }
        } catch (e) {
          console.log("Sem token account ou já vazio:", e);
        }
      }

      // Always transfer remaining SOL (for gas or main value if SOL)
      const updatedBalance = await connection.getBalance(tempKeypair.publicKey);
      if (updatedBalance > fee) {
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: tempKeypair.publicKey,
            toPubkey: publicKey,
            lamports: updatedBalance - fee
          })
        );
      }

      if (transaction.instructions.length === 0) {
        throw new Error("Nothing to refund. Link was already claimed.");
      }

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      transaction.feePayer = tempKeypair.publicKey;

      const sig = await connection.sendTransaction(transaction, [tempKeypair]);
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight });

      alert("Refund completed!");
      loadLinks();
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setLoadingId(null);
    }
  };

  const copyLink = (link: any) => {
    const url = `${window.location.origin}/claim?t=${link.symbol}&a=${link.amount}#${link.secretKey}`;
    navigator.clipboard.writeText(url);
    alert("Copied!");
  };

  if (links.length === 0)
    return (
      <div className="text-center mt-8 text-gray-600 text-xs">
        <p>No recent history.</p>
        <button onClick={() => fileInputRef.current?.click()} className="text-purple-400 underline mt-2">
          Restore Backup
        </button>
        <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".json" />
      </div>
    );

  return (
    <div className="w-full max-w-md mx-auto mt-8 bg-[#0F1115] border border-gray-800 rounded-2xl p-6">
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-800">
        <h3 className="text-white font-bold flex items-center gap-2">
          <span>
            <ScrollText />
          </span>{" "}
          History
        </h3>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="flex items-center text-[10px] bg-gray-800 text-gray-300 px-2 py-1 rounded gap-2 cursor-pointer"
          >
            <span>
              <Save size={16} />
            </span>
            Backup
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center text-[10px] bg-gray-800 text-gray-300 px-2 py-1 rounded gap-2 cursor-pointer"
          >
            <span>
              <FolderOpen size={16} />
            </span>
            Restore
          </button>
          <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".json" />
          <button
            onClick={loadLinks}
            className="text-[10px] bg-gray-800 text-purple-400 px-2 py-1 rounded cursor-pointer"
          >
            <span>
              <RotateCw />
            </span>
          </button>
        </div>
      </div>

      <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar">
        {links.map((link) => (
          <div
            key={link.id}
            className={`bg-gray-900 p-3 rounded-lg border flex justify-between items-center hover:border-gray-700 transition-all ${
              link.status === "partial" ? "border-orange-500/50" : "border-gray-800"
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">
                  {link.amount} {link.symbol}
                </span>
                {link.status === "partial" ? (
                  <span className="text-[9px] bg-orange-900/30 text-orange-400 px-1.5 py-0.5 rounded font-bold animate-pulse">
                    ⚠️ RECOVER
                  </span>
                ) : link.status === "pending" ? (
                  <span className="text-[9px] bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded font-bold">
                    PENDING
                  </span>
                ) : link.isActive ? (
                  <span className="text-[9px] bg-yellow-900/30 text-yellow-500 px-1.5 py-0.5 rounded font-bold">
                    ACTIVE
                  </span>
                ) : (
                  <span className="text-[9px] bg-green-900/30 text-green-500 px-1.5 py-0.5 rounded font-bold">
                    CLAIMED
                  </span>
                )}
              </div>
              <p className="text-[10px] text-gray-500 mt-1">{new Date(link.createdAt).toLocaleString()}</p>
              {link.status === "partial" && (
                <p className="text-[9px] text-orange-400 mt-1">Funds in temp wallet. Click ✕ to recover.</p>
              )}
            </div>

            <div className="flex gap-2">
              {link.isActive || link.status === "partial" ? (
                <>
                  {link.status !== "partial" && (
                    <button
                      onClick={() => copyLink(link)}
                      className="p-2 bg-blue-900/20 text-blue-400 rounded hover:bg-blue-900/40"
                      title="Copy"
                    >
                      📋
                    </button>
                  )}
                  <button
                    onClick={() => handleRefund(link)}
                    disabled={loadingId === link.id}
                    className={`p-2 rounded ${
                      link.status === "partial"
                        ? "bg-orange-900/30 text-orange-400 hover:bg-orange-900/50"
                        : "bg-red-900/20 text-red-400 hover:bg-red-900/40"
                    }`}
                    title={link.status === "partial" ? "Recover Funds" : "Cancel"}
                  >
                    {loadingId === link.id ? "..." : link.status === "partial" ? "🔄" : "✕"}
                  </button>
                </>
              ) : (
                <span className="text-[10px] text-gray-600 italic px-2">Completed</span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center mt-4 gap-2">
        <span>
          <Lock size={16} />
        </span>{" "}
        <p className="text-xs text-center">Data stored locally.</p>
      </div>
    </div>
  );
}
