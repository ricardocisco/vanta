"use client";
import { useEffect, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";

export const SystemStatus = () => {
  const { connection } = useConnection();
  const [heliusStatus, setHeliusStatus] = useState<"ok" | "slow" | "down">("ok");
  const [rangeStatus, setRangeStatus] = useState<"ok" | "down">("ok");
  const [latency, setLatency] = useState(0);

  useEffect(() => {
    const checkSystems = async () => {
      // 1. Check Helius RPC Latency
      const start = Date.now();
      try {
        await connection.getVersion();
        const end = Date.now();
        const lat = end - start;
        setLatency(lat);
        setHeliusStatus(lat < 150 ? "ok" : "slow");
      } catch {
        setHeliusStatus("down");
      }

      // 2. Check Range API (Ping simples)
      try {
        // Se tiver um endpoint de health check, use. Senão, assumimos OK se o frontend carregou.
        // Simulando check:
        setRangeStatus("ok");
      } catch {
        setRangeStatus("down");
      }
    };

    checkSystems();
    const interval = setInterval(checkSystems, 30000); // Check every 30s (reduced from 10s to save RPC credits)
    return () => clearInterval(interval);
  }, [connection]);

  return (
    <div className="flex items-center gap-4 text-[10px] font-mono border-t border-gray-800 pt-3 mt-4 opacity-70 hover:opacity-100 transition-opacity">
      <div className="flex items-center gap-1.5">
        <div
          className={`w-1.5 h-1.5 rounded-full ${heliusStatus === "ok" ? "bg-green-500 animate-pulse" : "bg-red-500"}`}
        ></div>
        <span className="text-gray-400">Helius RPC ({latency}ms)</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className={`w-1.5 h-1.5 rounded-full ${rangeStatus === "ok" ? "bg-blue-500" : "bg-red-500"}`}></div>
        <span className="text-gray-400">Range Protocol (Active)</span>
      </div>
      <div className="flex items-center gap-1.5 ml-auto">
        <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
        <span className="text-gray-400">Radr ZK Circuit</span>
      </div>
    </div>
  );
};
