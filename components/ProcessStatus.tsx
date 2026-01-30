import React from "react";

type StepStatus = "pending" | "loading" | "success" | "error";

interface ProcessStep {
  id: string;
  label: string;
  status: StepStatus;
  detail?: string;
}

interface ProcessStatusProps {
  steps: ProcessStep[];
  title?: string;
  showTitle?: boolean;
}

export const ProcessStatus = ({ steps, title = "Progresso", showTitle = true }: ProcessStatusProps) => {
  return (
    <div className="space-y-0 relative">
      {showTitle && <h4 className="text-xs uppercase text-gray-500 font-bold mb-4">{title}</h4>}

      {steps.map((step, idx) => (
        <div key={step.id} className="relative flex min-h-12">
          {/* Linha conectora vertical */}
          {idx !== steps.length - 1 && (
            <div
              className={`absolute left-2.75 top-6 bottom-0 w-0.5 z-0 transition-colors duration-300 ${
                step.status === "success" ? "bg-green-500/50" : "bg-gray-800"
              }`}
            />
          )}

          <div className="relative z-10 flex items-start gap-3">
            {/* Ícone de Status */}
            <div
              className={`
                w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[10px] border-2 transition-all duration-300
                ${step.status === "pending" && "bg-gray-900 border-gray-700 text-gray-600"}
                ${step.status === "loading" && "bg-blue-900 border-blue-500 text-white animate-pulse"}
                ${step.status === "success" && "bg-green-900 border-green-500 text-green-400"}
                ${step.status === "error" && "bg-red-900 border-red-500 text-red-400"}
              `}
            >
              {step.status === "success" && "✓"}
              {step.status === "error" && "✕"}
              {step.status === "pending" && <span className="text-gray-600">{idx + 1}</span>}
              {step.status === "loading" && (
                <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              )}
            </div>

            {/* Label e Detalhe */}
            <div className="flex-1 pb-3">
              <p
                className={`text-sm font-medium transition-colors ${
                  step.status === "pending"
                    ? "text-gray-500"
                    : step.status === "loading"
                      ? "text-white"
                      : step.status === "success"
                        ? "text-gray-200"
                        : "text-red-400"
                }`}
              >
                {step.label}
              </p>
              {step.detail && step.status !== "pending" && (
                <p className={`text-xs mt-0.5 ${step.status === "error" ? "text-red-400/70" : "text-gray-500"}`}>
                  {step.detail}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
