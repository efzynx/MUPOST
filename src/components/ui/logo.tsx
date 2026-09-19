import React from "react";
import { cn } from "@/lib/utils";

export interface MupostLogoProps extends React.SVGProps<SVGSVGElement> {
  variant?: "default" | "grounded" | "accent" | "squircle";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  xs: "w-4 h-3",
  sm: "w-6 h-4",
  md: "w-8 h-5",
  lg: "w-12 h-8",
  xl: "w-16 h-11",
};

/**
 * Mupost Logo Component
 * Berdasarkan sketsa konsep geometris:
 * - Sayap kiri: Solid diagonal band (\)
 * - Elemen tengah: Segitiga terbalik (▼)
 * - Sayap kanan: Wireframe/outline diagonal band (/)
 */
export function MupostLogo({
  variant = "accent",
  size = "md",
  className,
  ...props
}: MupostLogoProps) {
  const sizeClass = size ? sizeClasses[size] : "";

  if (variant === "squircle") {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800/90 shadow-sm p-1.5",
          className
        )}
      >
        <svg
          viewBox="0 0 120 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={cn("w-full h-full", sizeClass)}
          {...props}
        >
          <defs>
            <linearGradient id="mupostGradSquircle" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#818CF8" />
            </linearGradient>
          </defs>
          <polygon points="16,16 33,16 45,68 28,68" fill="currentColor" />
          <polygon points="41,16 79,16 60,54" fill="currentColor" />
          <polygon
            points="87,16 104,16 92,68 75,68"
            fill="none"
            stroke="url(#mupostGradSquircle)"
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }

  if (variant === "accent" || variant === "default") {
    return (
      <svg
        viewBox="0 0 120 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn(sizeClass, className)}
        {...props}
      >
        <defs>
          <linearGradient id="mupostAccentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#818CF8" />
          </linearGradient>
        </defs>
        {/* Sayap kiri */}
        <polygon points="16,16 33,16 45,68 28,68" fill="currentColor" />
        {/* Segitiga tengah */}
        <polygon points="41,16 79,16 60,54" fill="currentColor" />
        {/* Sayap kanan wireframe dengan aksen cyan gradient */}
        <polygon
          points="87,16 104,16 92,68 75,68"
          fill="none"
          stroke="url(#mupostAccentGrad)"
          strokeWidth="4.5"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (variant === "grounded") {
    return (
      <svg
        viewBox="0 0 120 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn(sizeClass, className)}
        {...props}
      >
        {/* Sayap kiri */}
        <polygon points="16,16 33,16 47,68 30,68" fill="currentColor" />
        {/* Segitiga tengah menyentuh baseline */}
        <polygon points="41,16 79,16 60,68" fill="currentColor" />
        {/* Sayap kanan wireframe */}
        <polygon
          points="87,16 104,16 90,68 73,68"
          fill="none"
          stroke="currentColor"
          strokeWidth="4.5"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 120 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(sizeClass, className)}
      {...props}
    >
      <polygon points="16,16 33,16 45,68 28,68" fill="currentColor" />
      <polygon points="41,16 79,16 60,54" fill="currentColor" />
      <polygon
        points="87,16 104,16 92,68 75,68"
        fill="none"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface MupostBrandProps {
  variant?: "default" | "grounded" | "accent";
  size?: "sm" | "md" | "lg";
  className?: string;
  showTagline?: boolean;
}

/**
 * Brand Logo + Text "Mupost" Lockup
 */
export function MupostBrand({
  variant = "accent",
  size = "md",
  className,
  showTagline = false,
}: MupostBrandProps) {
  const iconSizes = {
    sm: "w-5 h-3.5",
    md: "w-7 h-5",
    lg: "w-9 h-6",
  };

  const textSizes = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-xl",
  };

  return (
    <div className={cn("flex items-center gap-2.5 select-none", className)}>
      <div className="flex items-center justify-center">
        <MupostLogo
          variant={variant}
          className={cn("text-zinc-100", iconSizes[size])}
        />
      </div>
      <div className="flex flex-col">
        <span
          className={cn(
            "font-bold tracking-tight text-zinc-100 leading-none",
            textSizes[size]
          )}
        >
          Mupost
        </span>
        {showTagline && (
          <span className="text-[10px] text-zinc-400 tracking-normal mt-0.5">
            Multi-platform publisher
          </span>
        )}
      </div>
    </div>
  );
}
