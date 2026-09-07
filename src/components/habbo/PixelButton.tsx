import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "gold" | "blue" | "grey" | "danger" | "success";
  size?: "sm" | "md";
};

const variants: Record<NonNullable<Props["variant"]>, string> = {
  gold: "bg-primary text-primary-foreground hover:brightness-105",
  blue: "bg-secondary text-secondary-foreground hover:brightness-110",
  grey: "bg-muted text-foreground hover:brightness-105",
  danger: "bg-destructive text-destructive-foreground hover:brightness-110",
  success: "bg-success text-success-foreground hover:brightness-110",
};

export function PixelButton({ variant = "gold", size = "md", className, ...props }: Props) {
  return (
    <button
      {...props}
      className={cn(
        "font-pixel inline-flex items-center justify-center gap-2 rounded-sm border-2 border-border-strong transition-all",
        "shadow-[2px_2px_0_0_var(--border-strong)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
        "disabled:cursor-not-allowed disabled:opacity-60",
        size === "sm" ? "px-2 py-1 text-[0.55rem]" : "px-3 py-2 text-[0.65rem]",
        variants[variant],
        className,
      )}
    />
  );
}
