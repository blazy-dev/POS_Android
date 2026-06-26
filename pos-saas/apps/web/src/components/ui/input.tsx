import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-4.5 py-2 text-sm text-slate-200 shadow-sm transition-all placeholder:text-slate-600 focus-visible:outline-none focus-visible:border-indigo-500/80 focus-visible:ring-3 focus-visible:ring-indigo-500/15 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
