"use client";
import { useEffect, useState, useMemo } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
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
          recentTxs,
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
      <div className="mt-8 rounded-2xl overflow-hidden border border-gray-800 bg-linear-to-br from-[#0a0a0a] to-[#111] p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gray-800/50 flex items-center justify-center">
            <Eye className="text-gray-500" size={24} />
          </div>
          <div>
            <h4 className="text-gray-300 font-bold text-sm">Surveillance Analysis</h4>
            <p className="text-xs text-gray-500">Connect your wallet to see your exposure level</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 rounded-2xl overflow-hidden border border-gray-800 bg-linear-to-br from-[#0a0a0a] to-[#111] transition-all">
      {/* HEADER - Always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-5 flex justify-between items-center hover:bg-white/2 transition-colors"
      >
        <div className="flex items-center gap-4">
          {/* Animated Eye Icon */}
          <div className="relative">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center ${
                surveillanceScore >= 60
                  ? "bg-red-900/30"
                  : surveillanceScore >= 40
                    ? "bg-yellow-900/30"
                    : "bg-green-900/30"
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
              <h4 className="text-white font-bold text-sm">Encrypt.trade</h4>
              <span className="text-[10px] bg-gray-800 px-2 py-0.5 rounded text-gray-400">Surveillance Analysis</span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              {isLoading ? (
                <span className="text-xs text-gray-500 animate-pulse">Analyzing your exposure...</span>
              ) : (
                <>
                  <span className={`text-xs font-bold ${surveillanceLevel.color}`}>
                    {surveillanceLevel.level} EXPOSURE
                  </span>
                  <span className="text-xs text-gray-500">•</span>
                  <span className="text-xs text-gray-400">Score: {surveillanceScore}/100</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Mini score bar */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-24 h-2 bg-gray-800 rounded-full overflow-hidden">
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
            <ChevronUp className="text-gray-500" size={20} />
          ) : (
            <ChevronDown className="text-gray-500" size={20} />
          )}
        </div>
      </button>

      {/* EXPANDED CONTENT */}
      {expanded && (
        <div className="border-t border-gray-800 animate-in fade-in slide-in-from-top-2 duration-300">
          {/* TRACK 1: The Problem - Surveillance Exposure */}
          <div className="p-5 border-b border-gray-800">
            <div className="flex items-center gap-2 mb-4">
              <TriangleAlert className="text-red-400" size={18} />
              <h5 className="text-red-400 font-bold text-xs uppercase tracking-wider">
                What The Blockchain Reveals About You
              </h5>
            </div>

            {/* Surveillance Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-black/40 border border-gray-800 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="text-gray-500" size={14} />
                  <span className="text-[10px] text-gray-500 uppercase">Balance</span>
                </div>
                <p className="text-lg font-bold text-white font-mono">{publicData.balance.toFixed(2)}</p>
                <p className="text-[10px] text-gray-500">SOL visible</p>
              </div>

              <div className="bg-black/40 border border-gray-800 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="text-gray-500" size={14} />
                  <span className="text-[10px] text-gray-500 uppercase">Activity</span>
                </div>
                <p className="text-lg font-bold text-white font-mono">{publicData.txCount}+</p>
                <p className="text-[10px] text-gray-500">Transactions</p>
              </div>

              <div className="bg-black/40 border border-gray-800 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Network className="text-gray-500" size={14} />
                  <span className="text-[10px] text-gray-500 uppercase">Network</span>
                </div>
                <p className="text-lg font-bold text-white font-mono">{publicData.uniqueInteractions}</p>
                <p className="text-[10px] text-gray-500">Connections</p>
              </div>

              <div className="bg-black/40 border border-gray-800 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="text-gray-500" size={14} />
                  <span className="text-[10px] text-gray-500 uppercase">Age</span>
                </div>
                <p className="text-lg font-bold text-white font-mono">{publicData.oldestTxDays}</p>
                <p className="text-[10px] text-gray-500">Days tracked</p>
              </div>
            </div>

            {/* What This Means */}
            <div className="bg-red-950/20 border border-red-500/20 rounded-xl p-4">
              <h6 className="text-red-400 font-bold text-xs mb-3 flex items-center gap-2">
                <Fingerprint size={14} />
                What trackers can see:
              </h6>
              <ul className="space-y-2 text-xs text-gray-300">
                <li className="flex items-start gap-2">
                  <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={12} />
                  <span>
                    Every transaction you&apos;ve ever made is{" "}
                    <strong className="text-red-400">permanently recorded</strong>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={12} />
                  <span>
                    Your wallet can be linked to{" "}
                    <strong className="text-red-400">exchanges, social profiles, and IP addresses</strong>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={12} />
                  <span>
                    Platforms like <strong className="text-red-400">Arkham, Nansen, and 0xScope</strong> cluster and
                    label wallets
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={12} />
                  <span>
                    A single public transaction <strong className="text-red-400">permanently links</strong> sender and
                    receiver
                  </span>
                </li>
              </ul>

              {/* External Links */}
              <div className="flex flex-wrap gap-2 mt-4">
                <a
                  href={`https://solscan.io/account/${publicKey.toBase58()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] bg-black/50 border border-gray-700 px-2 py-1 rounded flex items-center gap-1 text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
                >
                  <Globe size={10} /> Solscan
                  <ExternalLink size={8} />
                </a>
                <a
                  href={`https://solana.fm/address/${publicKey.toBase58()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] bg-black/50 border border-gray-700 px-2 py-1 rounded flex items-center gap-1 text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
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
              <ShieldCheck className="text-green-400" size={18} />
              <h5 className="text-green-400 font-bold text-xs uppercase tracking-wider">
                How Vanta Protocol Protects You
              </h5>
            </div>

            {/* Visual Flow Diagram */}
            <div className="bg-green-950/10 border border-green-500/20 rounded-xl p-5 mb-4">
              <div className="flex items-center justify-between mb-6">
                {/* Sender */}
                <div className="flex flex-col items-center">
                  <div className="w-14 h-14 rounded-full bg-red-900/30 border-2 border-red-500/50 flex items-center justify-center mb-2">
                    <User className="text-red-400" size={24} />
                  </div>
                  <span className="text-xs font-bold text-red-400">You</span>
                  <span className="text-[9px] text-gray-500">Exposed</span>
                </div>

                {/* Arrow + ZK Break */}
                <div className="flex-1 flex items-center justify-center relative px-4">
                  <div className="absolute inset-x-4 top-1/2 h-0.5 bg-linear-to-r from-red-500/50 via-transparent to-green-500/50" />
                  <div className="relative z-10 bg-[#0a0a0a] border-2 border-purple-500 rounded-full p-2">
                    <Scissors className="text-purple-400" size={20} />
                  </div>
                </div>

                {/* ZK Pool */}
                <div className="flex flex-col items-center">
                  <div className="w-14 h-14 rounded-full bg-purple-900/30 border-2 border-purple-500/50 flex items-center justify-center mb-2 relative">
                    <Lock className="text-purple-400" size={24} />
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
                      <span className="text-[8px] text-white font-bold">ZK</span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-purple-400">Pool</span>
                  <span className="text-[9px] text-gray-500">Anonymous</span>
                </div>

                {/* Arrow + ZK Break */}
                <div className="flex-1 flex items-center justify-center relative px-4">
                  <div className="absolute inset-x-4 top-1/2 h-0.5 bg-linear-to-r from-purple-500/50 via-transparent to-green-500/50" />
                  <div className="relative z-10 bg-[#0a0a0a] border-2 border-green-500 rounded-full p-2">
                    <EyeOff className="text-green-400" size={20} />
                  </div>
                </div>

                {/* Recipient */}
                <div className="flex flex-col items-center">
                  <div className="w-14 h-14 rounded-full bg-green-900/30 border-2 border-green-500/50 flex items-center justify-center mb-2">
                    <Gift className="text-green-400" size={24} />
                  </div>
                  <span className="text-xs font-bold text-green-400">Recipient</span>
                  <span className="text-[9px] text-gray-500">Protected</span>
                </div>
              </div>

              {/* Explanation */}
              <div className="text-center">
                <p className="text-xs text-gray-300 leading-relaxed">
                  Vanta acts as a <strong className="text-purple-400">&quot;Financial Firewall&quot;</strong>. When you
                  send funds, they enter a <strong className="text-purple-400">Zero-Knowledge pool</strong> where the
                  link between sender and receiver is <strong className="text-green-400">mathematically broken</strong>.
                </p>
              </div>
            </div>

            {/* Key Benefits */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-black/40 border border-gray-800 rounded-xl p-3 text-center">
                <div className="w-8 h-8 rounded-full bg-green-900/30 flex items-center justify-center mx-auto mb-2">
                  <EyeOff className="text-green-400" size={16} />
                </div>
                <h6 className="text-xs font-bold text-white mb-1">Unlinkable</h6>
                <p className="text-[10px] text-gray-500">No one can trace funds back to you</p>
              </div>

              <div className="bg-black/40 border border-gray-800 rounded-xl p-3 text-center">
                <div className="w-8 h-8 rounded-full bg-green-900/30 flex items-center justify-center mx-auto mb-2">
                  <ShieldCheck className="text-green-400" size={16} />
                </div>
                <h6 className="text-xs font-bold text-white mb-1">Compliant</h6>
                <p className="text-[10px] text-gray-500">Range Protocol checks every wallet</p>
              </div>

              <div className="bg-black/40 border border-gray-800 rounded-xl p-3 text-center">
                <div className="w-8 h-8 rounded-full bg-green-900/30 flex items-center justify-center mx-auto mb-2">
                  <Lock className="text-green-400" size={16} />
                </div>
                <h6 className="text-xs font-bold text-white mb-1">Zero-Knowledge</h6>
                <p className="text-[10px] text-gray-500">Cryptographic privacy guarantees</p>
              </div>
            </div>

            {/* Learn More Link */}
            <div className="mt-4 text-center">
              <a
                href="https://encrypt.trade"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-purple-400 hover:text-purple-300 inline-flex items-center gap-1"
              >
                Learn more about privacy on Solana
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
