import { Check, X, Loader2 } from "lucide-react";

export type StepStatus = "pending" | "loading" | "success" | "error";

export interface ProcessStep {
  id: string;
  label: string;
  status: StepStatus;
  detail?: string;
  icon?: React.ElementType;
}

interface ProcessStatusProps {
  steps: ProcessStep[];
  title?: string;
  showTitle?: boolean;
}

export const ProcessStatus = ({ steps, title = "Progresso", showTitle = true }: ProcessStatusProps) => {
  return (
    <div className="space-y-0 relative">
      {showTitle && <h4 className="text-xs uppercase text-muted-foreground font-bold mb-4">{title}</h4>}

      {steps.map((step, idx) => (
        <div key={step.id} className="relative flex min-h-12">
          {idx !== steps.length - 1 && (
            <div
              className={`absolute left-2.75 top-6 bottom-0 w-0.5 z-0 transition-colors duration-300 ${
                step.status === "success" ? "bg-green-500/50" : "bg-border"
              }`}
            />
          )}

          <div className="relative z-10 flex items-start gap-3">
            <div
              className={`
                w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[10px] border-2 transition-all duration-300
                ${step.status === "pending" && "bg-muted border-muted-foreground/30 text-muted-foreground"}
                ${step.status === "loading" && "bg-primary/10 border-primary text-primary shadow-[0_0_10px_rgba(0,255,65,0.3)]"}
                ${step.status === "success" && "bg-green-500/10 border-green-500 text-green-500"}
                ${step.status === "error" && "bg-destructive/10 border-destructive text-destructive"}
              `}
            >
              {step.status === "success" && <Check size={14} />}
              {step.status === "error" && <X size={14} />}
              {step.status === "loading" && <Loader2 size={14} className="animate-spin" />}
              {step.status === "pending" && (step.icon ? <step.icon size={12} /> : <span>{idx + 1}</span>)}
            </div>

            <div className="flex-1 pb-3">
              <p
                className={`text-sm font-bold transition-colors ${
                  step.status === "pending"
                    ? "text-muted-foreground"
                    : step.status === "loading"
                      ? "text-primary"
                      : step.status === "success"
                        ? "text-foreground"
                        : "text-destructive"
                }`}
              >
                {step.label}
              </p>
              {step.detail && step.status !== "pending" && (
                <p
                  className={`text-xs mt-0.5 ${step.status === "error" ? "text-destructive/70" : "text-muted-foreground"}`}
                >
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
