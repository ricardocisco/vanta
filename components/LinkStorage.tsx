/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderOpen, Lock, RotateCw, Save, ScrollText, ChevronDown, ChevronUp, Copy, RefreshCw, X } from "lucide-react";

export default function LinkHistory() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [links, setLinks] = useState<any[]>([]);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState(false); // Collapsed by default

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
      <Card className="max-w-md mx-auto mt-8 border-dashed">
        <CardContent className="flex flex-col items-center justify-center p-6 text-muted-foreground text-xs">
          <p>No recent history.</p>
          <Button variant="link" onClick={() => fileInputRef.current?.click()} className="h-auto p-0 text-primary mt-2">
            Restore Backup
          </Button>
          <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".json" />
        </CardContent>
      </Card>
    );

  return (
    <Card className="w-full mt-8 overflow-hidden transition-all duration-300 border-none shadow-none bg-transparent">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-4 sm:p-6 border rounded-t-xl bg-card hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2 font-bold text-foreground">
          {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          <ScrollText size={18} className="text-primary" />
          <span>History</span>
          <span className="text-xs text-muted-foreground font-normal">({links.length})</span>
        </div>
      </button>

      {isOpen && (
        <CardContent className="p-4 sm:p-6 animate-in slide-in-from-top-2 fade-in duration-200">
          <div className="flex justify-end gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={handleExport} className="h-7 text-[10px] gap-2">
              <Save size={14} /> Backup
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="h-7 text-[10px] gap-2"
            >
              <FolderOpen size={14} /> Restore
            </Button>
            <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".json" />
            <Button variant="outline" size="icon" onClick={loadLinks} className="h-7 w-7">
              <RotateCw size={14} />
            </Button>
          </div>

          <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar">
            {links.map((link) => (
              <div
                key={link.id}
                className={`p-3 rounded-lg border flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 sm:gap-2 transition-all ${
                  link.status === "partial"
                    ? "bg-orange-500/10 border-orange-500/50"
                    : "bg-muted/50 border-input hover:border-gray-600"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-foreground text-sm whitespace-nowrap">
                      {link.amount} {link.symbol}
                    </span>
                    {link.status === "partial" ? (
                      <span className="text-[9px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded font-bold animate-pulse whitespace-nowrap">
                        ⚠️ RECOVER
                      </span>
                    ) : link.status === "pending" ? (
                      <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">
                        PENDING
                      </span>
                    ) : link.isActive ? (
                      <span className="text-[9px] bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">
                        ACTIVE
                      </span>
                    ) : (
                      <span className="text-[9px] bg-green-500/20 text-green-500 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">
                        CLAIMED
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 font-mono truncate">
                    {new Date(link.createdAt).toLocaleString()}
                  </p>
                  {link.status === "partial" && (
                    <p className="text-[9px] text-orange-400 mt-1">Funds in temp wallet. Click ✕ to recover.</p>
                  )}
                </div>

                <div className="flex gap-2 justify-end sm:justify-start">
                  {link.isActive || link.status === "partial" ? (
                    <>
                      {link.status !== "partial" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyLink(link)}
                          className="h-8 w-8 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10"
                          title="Copy"
                        >
                          <Copy size={14} />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRefund(link)}
                        disabled={loadingId === link.id}
                        className={`h-8 w-8 ${
                          link.status === "partial"
                            ? "text-orange-400 hover:text-orange-300 hover:bg-orange-400/10"
                            : "text-red-400 hover:text-red-300 hover:bg-red-400/10"
                        }`}
                        title={link.status === "partial" ? "Recover Funds" : "Cancel"}
                      >
                        {loadingId === link.id ? (
                          <RefreshCw size={14} className="animate-spin" />
                        ) : link.status === "partial" ? (
                          <RefreshCw size={14} />
                        ) : (
                          <X size={14} />
                        )}
                      </Button>
                    </>
                  ) : (
                    <span className="text-[10px] text-muted-foreground italic px-2">Completed</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center mt-4 gap-2 text-muted-foreground">
            <Lock size={16} />
            <p className="text-xs text-center">Data stored locally.</p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
