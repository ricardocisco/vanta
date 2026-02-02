"use client";
import { useEffect, useState, useMemo } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Eye,
  EyeOff,
  Gift,
  Scissors,
  ShieldCheck,
  TriangleAlert,
  User,
  Network,
  Clock,
  Fingerprint,
  TrendingDown,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Wallet,
  Activity,
  Globe,
  Lock
} from "lucide-react";

// Surveillance Score Calculation
const calculateSurveillanceScore = (data: {
  txCount: number;
  balance: number;
  uniqueInteractions: number;
  oldestTxDays: number;
  hasTokenActivity: boolean;
}): number => {
  let score = 0;

  // Transaction count (more tx = more exposed)
  if (data.txCount >= 100) score += 30;
  else if (data.txCount >= 50) score += 25;
  else if (data.txCount >= 20) score += 20;
  else if (data.txCount >= 10) score += 15;
  else if (data.txCount >= 5) score += 10;
  else if (data.txCount > 0) score += 5;

  // Balance visibility
  if (data.balance >= 100) score += 20;
  else if (data.balance >= 10) score += 15;
  else if (data.balance >= 1) score += 10;
  else if (data.balance > 0) score += 5;

  // Unique wallet interactions
  if (data.uniqueInteractions >= 20) score += 25;
  else if (data.uniqueInteractions >= 10) score += 20;
  else if (data.uniqueInteractions >= 5) score += 15;
  else if (data.uniqueInteractions > 0) score += 10;

  // Wallet age (older = more data collected)
  if (data.oldestTxDays >= 365) score += 15;
  else if (data.oldestTxDays >= 180) score += 12;
  else if (data.oldestTxDays >= 90) score += 10;
  else if (data.oldestTxDays >= 30) score += 7;
  else if (data.oldestTxDays > 0) score += 5;

  // Token activity
  if (data.hasTokenActivity) score += 10;

  return Math.min(score, 100);
};

const getSurveillanceLevel = (score: number): { level: string; color: string; description: string } => {
  if (score >= 80) return { level: "CRITICAL", color: "text-red-500", description: "Your wallet is fully profiled" };
  if (score >= 60) return { level: "HIGH", color: "text-orange-500", description: "Significant exposure detected" };
  if (score >= 40) return { level: "MODERATE", color: "text-yellow-500", description: "Some tracking vectors exist" };
  if (score >= 20) return { level: "LOW", color: "text-green-400", description: "Limited exposure" };
  return { level: "MINIMAL", color: "text-green-500", description: "Very limited on-chain footprint" };
};

export const PrivacyEducation = () => {
  const { connection } = useConnection();
  const { publicKey } = useWallet();

  const [isLoading, setIsLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [publicData, setPublicData] = useState({
    balance: 0,
    txCount: 0,
    uniqueInteractions: 0,
    oldestTxDays: 0,
    hasTokenActivity: false,
    recentTxs: [] as Array<{ signature: string; blockTime: number | null }>,
    interactedAddresses: [] as string[]
  });

  // Calculate surveillance metrics
  const surveillanceScore = useMemo(() => calculateSurveillanceScore(publicData), [publicData]);
  const surveillanceLevel = useMemo(() => getSurveillanceLevel(surveillanceScore), [surveillanceScore]);

  // Fetch all public data about the wallet (the "creepy" effect)
  useEffect(() => {
    if (!publicKey) {
      setIsLoading(false);
      return;
    }

    const fetchPublicData = async () => {
      setIsLoading(true);
      try {
        // 1. Get balance
        const balance = await connection.getBalance(publicKey);

        // 2. Get transaction history
        const signatures = await connection.getSignaturesForAddress(publicKey, {
          limit: 100
        });

        // 3. Extract unique interacted addresses from recent txs
        const recentTxs = signatures.slice(0, 10).map((sig) => ({
          signature: sig.signature,
          blockTime: sig.blockTime
        }));

        // 4. Calculate wallet age
        const oldestTx = signatures[signatures.length - 1];
        const oldestTxDays = oldestTx?.blockTime ? Math.floor((Date.now() / 1000 - oldestTx.blockTime) / 86400) : 0;

        // 5. Estimate unique interactions (simplified)
        const uniqueAddresses = new Set<string>();
        // In a real implementation, you'd parse each tx to get actual interacted addresses
        // For demo, we estimate based on tx count
        const estimatedUnique = Math.min(signatures.length, Math.floor(signatures.length * 0.7));

        setPublicData({
          balance: balance / LAMPORTS_PER_SOL,
          txCount: signatures.length,
          uniqueInteractions: estimatedUnique,
          oldestTxDays,
          hasTokenActivity: signatures.length > 5,
          recentTxs: recentTxs.map((tx) => ({ ...tx, blockTime: tx.blockTime ?? null })),
          interactedAddresses: Array.from(uniqueAddresses)
        });
      } catch (e) {
        console.debug("PrivacyEducation: error fetching data", e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPublicData();
  }, [publicKey, connection]);

  // Don't show if no wallet connected
  if (!publicKey) {
    return (
      <Card className="mt-8 p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Eye className="text-muted-foreground" size={24} />
          </div>
          <div>
            <h4 className="font-bold text-sm text-foreground">Surveillance Analysis</h4>
            <p className="text-xs text-muted-foreground">Connect your wallet to see your exposure level</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mt-8 overflow-hidden transition-all">
      {/* HEADER - Always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-5 flex justify-between items-center hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-4">
          {/* Animated Eye Icon */}
          <div className="relative">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center ${
                surveillanceScore >= 60
                  ? "bg-red-500/20"
                  : surveillanceScore >= 40
                    ? "bg-yellow-500/20"
                    : "bg-green-500/20"
              }`}
            >
              <Eye className={surveillanceLevel.color} size={24} />
            </div>
            {/* Pulsing ring for high exposure */}
            {surveillanceScore >= 60 && (
              <div className="absolute inset-0 rounded-full border-2 border-red-500/50 animate-ping" />
            )}
          </div>

          <div className="text-left">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-sm">Encrypt.trade</h4>
              <span className="text-[10px] bg-muted px-2 py-0.5 rounded text-muted-foreground">
                Surveillance Analysis
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              {isLoading ? (
                <span className="text-xs text-muted-foreground animate-pulse">Analyzing your exposure...</span>
              ) : (
                <>
                  <span className={`text-xs font-bold ${surveillanceLevel.color}`}>
                    {surveillanceLevel.level} EXPOSURE
                  </span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground">Score: {surveillanceScore}/100</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Mini score bar */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  surveillanceScore >= 80
                    ? "bg-red-500"
                    : surveillanceScore >= 60
                      ? "bg-orange-500"
                      : surveillanceScore >= 40
                        ? "bg-yellow-500"
                        : "bg-green-500"
                }`}
                style={{ width: `${surveillanceScore}%` }}
              />
            </div>
          </div>
          {expanded ? (
            <ChevronUp className="text-muted-foreground" size={20} />
          ) : (
            <ChevronDown className="text-muted-foreground" size={20} />
          )}
        </div>
      </button>

      {/* EXPANDED CONTENT */}
      {expanded && (
        <CardContent className="p-0 border-t">
          {/* TRACK 1: The Problem - Surveillance Exposure */}
          <div className="p-5 border-b">
            <div className="flex items-center gap-2 mb-4">
              <TriangleAlert className="text-destructive" size={18} />
              <h5 className="text-destructive font-bold text-xs uppercase tracking-wider">
                What The Blockchain Reveals About You
              </h5>
            </div>

            {/* Surveillance Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-muted/50 border rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="text-muted-foreground" size={14} />
                  <span className="text-[10px] text-muted-foreground uppercase">Balance</span>
                </div>
                <p className="text-lg font-bold font-mono">{publicData.balance.toFixed(2)}</p>
                <p className="text-[10px] text-muted-foreground">SOL visible</p>
              </div>

              <div className="bg-muted/50 border rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="text-muted-foreground" size={14} />
                  <span className="text-[10px] text-muted-foreground uppercase">Activity</span>
                </div>
                <p className="text-lg font-bold font-mono">{publicData.txCount}+</p>
                <p className="text-[10px] text-muted-foreground">Transactions</p>
              </div>

              <div className="bg-muted/50 border rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Network className="text-muted-foreground" size={14} />
                  <span className="text-[10px] text-muted-foreground uppercase">Network</span>
                </div>
                <p className="text-lg font-bold font-mono">{publicData.uniqueInteractions}</p>
                <p className="text-[10px] text-muted-foreground">Connections</p>
              </div>

              <div className="bg-muted/50 border rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="text-muted-foreground" size={14} />
                  <span className="text-[10px] text-muted-foreground uppercase">Age</span>
                </div>
                <p className="text-lg font-bold font-mono">{publicData.oldestTxDays}</p>
                <p className="text-[10px] text-muted-foreground">Days tracked</p>
              </div>
            </div>

            {/* What This Means */}
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4">
              <h6 className="text-destructive font-bold text-xs mb-3 flex items-center gap-2">
                <Fingerprint size={14} />
                What trackers can see:
              </h6>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex items-start gap-2">
                  <AlertCircle className="text-destructive shrink-0 mt-0.5" size={12} />
                  <span>
                    Every transaction you&apos;ve ever made is{" "}
                    <strong className="text-destructive">permanently recorded</strong>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertCircle className="text-destructive shrink-0 mt-0.5" size={12} />
                  <span>
                    Your wallet can be linked to{" "}
                    <strong className="text-destructive">exchanges, social profiles, and IP addresses</strong>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertCircle className="text-destructive shrink-0 mt-0.5" size={12} />
                  <span>
                    Platforms like <strong className="text-destructive">Arkham, Nansen, and 0xScope</strong> cluster and
                    label wallets
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertCircle className="text-destructive shrink-0 mt-0.5" size={12} />
                  <span>
                    A single public transaction <strong className="text-destructive">permanently links</strong> sender
                    and receiver
                  </span>
                </li>
              </ul>

              {/* External Links */}
              <div className="flex flex-wrap gap-2 mt-4">
                <a
                  href={`https://solscan.io/account/${publicKey.toBase58()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] bg-background/50 border px-2 py-1 rounded flex items-center gap-1 text-muted-foreground hover:text-foreground hover:border-gray-500 transition-colors"
                >
                  <Globe size={10} /> Solscan
                  <ExternalLink size={8} />
                </a>
                <a
                  href={`https://solana.fm/address/${publicKey.toBase58()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] bg-background/50 border px-2 py-1 rounded flex items-center gap-1 text-muted-foreground hover:text-foreground hover:border-gray-500 transition-colors"
                >
                  <Globe size={10} /> Solana FM
                  <ExternalLink size={8} />
                </a>
              </div>
            </div>
          </div>

          {/* TRACK 2: The Solution - How Vanta Protects You */}
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="text-primary" size={18} />
              <h5 className="text-primary font-bold text-xs uppercase tracking-wider">
                How Vanta Protocol Protects You
              </h5>
            </div>

            {/* Visual Flow Diagram */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 mb-4">
              <div className="flex items-center justify-between mb-6">
                {/* Sender */}
                <div className="flex flex-col items-center">
                  <div className="w-14 h-14 rounded-full bg-destructive/20 border-2 border-destructive/50 flex items-center justify-center mb-2">
                    <User className="text-destructive" size={24} />
                  </div>
                  <span className="text-xs font-bold text-destructive">You</span>
                  <span className="text-[9px] text-muted-foreground">Exposed</span>
                </div>

                {/* Arrow + ZK Break */}
                <div className="flex-1 flex items-center justify-center relative px-4">
                  <div className="absolute inset-x-4 top-1/2 h-0.5 bg-linear-to-r from-destructive/50 via-transparent to-primary/50" />
                  <div className="relative z-10 bg-card border-2 border-secondary rounded-full p-2">
                    <Scissors className="text-secondary" size={20} />
                  </div>
                </div>

                {/* ZK Pool */}
                <div className="flex flex-col items-center">
                  <div className="w-14 h-14 rounded-full bg-secondary/20 border-2 border-secondary/50 flex items-center justify-center mb-2 relative">
                    <Lock className="text-secondary" size={24} />
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-secondary rounded-full flex items-center justify-center">
                      <span className="text-[8px] text-white font-bold">ZK</span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-secondary">Pool</span>
                  <span className="text-[9px] text-muted-foreground">Anonymous</span>
                </div>

                {/* Arrow + ZK Break */}
                <div className="flex-1 flex items-center justify-center relative px-4">
                  <div className="absolute inset-x-4 top-1/2 h-0.5 bg-linear-to-r from-secondary/50 via-transparent to-primary/50" />
                  <div className="relative z-10 bg-card border-2 border-primary rounded-full p-2">
                    <EyeOff className="text-primary" size={20} />
                  </div>
                </div>

                {/* Recipient */}
                <div className="flex flex-col items-center">
                  <div className="w-14 h-14 rounded-full bg-primary/20 border-2 border-primary/50 flex items-center justify-center mb-2">
                    <Gift className="text-primary" size={24} />
                  </div>
                  <span className="text-xs font-bold text-primary">Recipient</span>
                  <span className="text-[9px] text-muted-foreground">Protected</span>
                </div>
              </div>

              {/* Explanation */}
              <div className="text-center">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Vanta acts as a <strong className="text-secondary">&quot;Financial Firewall&quot;</strong>. When you
                  send funds, they enter a <strong className="text-secondary">Zero-Knowledge pool</strong> where the
                  link between sender and receiver is <strong className="text-primary">mathematically broken</strong>.
                </p>
              </div>
            </div>

            {/* Key Benefits */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-muted/50 border rounded-xl p-3 text-center">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-2">
                  <EyeOff className="text-primary" size={16} />
                </div>
                <h6 className="text-xs font-bold text-foreground mb-1">Unlinkable</h6>
                <p className="text-[10px] text-muted-foreground">No one can trace funds back to you</p>
              </div>

              <div className="bg-muted/50 border rounded-xl p-3 text-center">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-2">
                  <ShieldCheck className="text-primary" size={16} />
                </div>
                <h6 className="text-xs font-bold text-foreground mb-1">Compliant</h6>
                <p className="text-[10px] text-muted-foreground">Range Protocol checks every wallet</p>
              </div>

              <div className="bg-muted/50 border rounded-xl p-3 text-center">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-2">
                  <Lock className="text-primary" size={16} />
                </div>
                <h6 className="text-xs font-bold text-foreground mb-1">Zero-Knowledge</h6>
                <p className="text-[10px] text-muted-foreground">Cryptographic privacy guarantees</p>
              </div>
            </div>

            {/* Learn More Link */}
            <div className="mt-4 text-center">
              <a
                href="https://encrypt.trade"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-secondary hover:text-secondary/80 inline-flex items-center gap-1"
              >
                Learn more about privacy on Solana
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};
