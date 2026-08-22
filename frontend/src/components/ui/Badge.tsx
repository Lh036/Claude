import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "success" | "warning" | "danger" | "running" | "neutral" | "accent";

const TONE_CLASSES: Record<BadgeTone, string> = {
  success: "bg-[var(--color-success-soft)] text-[var(--color-success)]",
  warning: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
  danger: "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
  running: "bg-[var(--color-running-soft)] text-[var(--color-running)]",
  neutral: "bg-[var(--color-neutral-soft)] text-[var(--color-ink-muted)]",
  accent: "bg-[var(--color-accent-soft)] text-[var(--color-accent)]",
};

export function Badge({
  tone = "neutral",
  children,
  dot = false,
  className,
  ...rest
}: {
  tone?: BadgeTone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
} & Omit<HTMLAttributes<HTMLSpanElement>, "className" | "children">) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium leading-none",
        TONE_CLASSES[tone],
        className,
      )}
      {...rest}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", DOT_CLASSES[tone])} />}
      {children}
    </span>
  );
}

const DOT_CLASSES: Record<BadgeTone, string> = {
  success: "bg-[var(--color-success)]",
  warning: "bg-[var(--color-warning)]",
  danger: "bg-[var(--color-danger)]",
  running: "bg-[var(--color-running)] animate-pulse-soft",
  neutral: "bg-[var(--color-ink-faint)]",
  accent: "bg-[var(--color-accent)]",
};
