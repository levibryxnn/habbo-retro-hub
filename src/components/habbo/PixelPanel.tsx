import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  title?: ReactNode;
  actions?: ReactNode;
  variant?: "gold" | "blue";
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
};

export function PixelPanel({
  title,
  actions,
  variant = "blue",
  className,
  bodyClassName,
  children,
}: Props) {
  return (
    <section className={cn("pixel-panel overflow-hidden", className)}>
      {title ? (
        <header
          className={cn(
            "flex items-center justify-between gap-2 px-3 py-2",
            variant === "gold" ? "pixel-header" : "pixel-header-blue",
          )}
        >
          <h2 className="text-[0.7rem] leading-relaxed">{title}</h2>
          {actions}
        </header>
      ) : null}
      <div className={cn("p-3", bodyClassName)}>{children}</div>
    </section>
  );
}
