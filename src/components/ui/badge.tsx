import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "published" | "scheduled" | "failed" | "reauth";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variantStyles = {
    default: "bg-zinc-800 text-zinc-200 border-zinc-700/80",
    secondary: "bg-zinc-900 text-zinc-400 border-zinc-800",
    outline: "bg-transparent text-zinc-300 border-zinc-700",
    published: "bg-emerald-950/60 text-emerald-400 border-emerald-800/60",
    scheduled: "bg-amber-950/60 text-amber-400 border-amber-800/60",
    failed: "bg-red-950/60 text-red-400 border-red-800/60",
    reauth: cn("bg-orange-950/60", "text-orange-400", "border-orange-800/60"),
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-medium tracking-wide transition-colors select-none",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}
