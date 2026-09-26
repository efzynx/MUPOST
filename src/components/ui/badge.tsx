import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?:
    | "default"
    | "secondary"
    | "outline"
    | "published"
    | "scheduled"
    | "failed"
    | "reauth"
    | "publishing"
    | "queued";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variantStyles = {
    default: "bg-zinc-800 text-zinc-200 border-zinc-700/80",
    secondary: "bg-zinc-900 text-zinc-400 border-zinc-800",
    outline: "bg-transparent text-zinc-300 border-zinc-700",
    published:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800/60",
    scheduled:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-800/60",
    failed:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-400 dark:border-red-800/60",
    reauth: cn(
      "bg-orange-50 text-orange-700 border-orange-200",
      "dark:bg-orange-950/60 dark:text-orange-400 dark:border-orange-800/60"
    ),
    publishing:
      "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-400 dark:border-sky-800/60 animate-pulse",
    queued:
      "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-700/70 shadow-sm dark:shadow-indigo-950/50",
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
