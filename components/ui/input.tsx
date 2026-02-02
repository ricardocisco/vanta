import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Base styling
        "flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-all duration-200",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground",
        // Colors & Borders (Vanta Theme)
        "border-secondary/30 bg-black/20 text-foreground", // Default: Dark background, subtle purple border
        "hover:border-secondary/60 hover:bg-black/40", // Hover: Brighter purple border
        "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:shadow-[0_0_10px_rgba(0,255,65,0.2)]", // Focus: Green Border + Glow
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export { Input };
