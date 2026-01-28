import React from "react";

type StepStatus = "pending" | "loading" | "success" | "error";

interface ProcessStep {
  id: string;
  label: string;
  status: StepStatus;
  detail?: string;
}

export const ProcessStatus = ({ steps }: { steps: ProcessStep[] }) => {
  return (
    <div className="mt-4 space-y-3 bg-black/40 p-4 rounded-lg border border-gray-800">
      <h4 className="text-xs text-gray-400 uppercase font-bold mb-2">
        Processo de Segurança & Execução
      </h4>
      {steps.map((step) => (
        <div key={step.id} className="flex items-center gap-3">
          {/* Ícone de Status */}
          <div
            className={`
            w-6 h-6 rounded-full flex items-center justify-center text-xs border
            ${step.status === "pending" && "border-gray-600 text-gray-600 bg-transparent"}
            ${step.status === "loading" && "border-blue-500 text-blue-500 animate-spin border-t-transparent"}
            ${step.status === "success" && "border-green-500 bg-green-500/20 text-green-400"}
            ${step.status === "error" && "border-red-500 bg-red-500/20 text-red-400"}
          `}
          >
            {step.status === "success" && "✓"}
            {step.status === "error" && "✕"}
            {step.status === "pending" && "•"}
          </div>

          <div className="flex-1">
            <p
              className={`text-sm font-medium ${step.status === "pending" ? "text-gray-500" : "text-gray-200"}`}
            >
              {step.label}
            </p>
            {step.detail && step.status !== "pending" && (
              <p className="text-xs text-gray-400">{step.detail}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
