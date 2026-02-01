export const ComplianceBadge = ({ status }: { status: "idle" | "loading" | "safe" | "risk" }) => {
  if (status === "idle") return null;

  return (
    <div
      className={`flex items-center gap-2 text-xs px-3 py-1 rounded-full border transition-all duration-500 ${
        status === "loading"
          ? "bg-blue-900/20 border-blue-500 text-blue-400"
          : status === "safe"
            ? "bg-green-900/20 border-green-500 text-green-400"
            : "bg-red-900/20 border-red-500 text-red-400"
      }`}
    >
      {status === "loading" && <span className="animate-spin">⏳</span>}
      {status === "safe" && <span>🛡️</span>}
      {status === "risk" && <span>⚠️</span>}

      <span className="font-bold">
        {status === "loading"
          ? "Checking Range API..."
          : status === "safe"
            ? "Wallet Safe (Range Verified)"
            : "Risk Detected!"}
      </span>
    </div>
  );
};
