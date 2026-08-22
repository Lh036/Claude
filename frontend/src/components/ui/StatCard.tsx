import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "accent";
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-muted)]">{label}</span>
        {icon && <span className={cn("rounded-md p-1.5", ICON_TONE[tone])}>{icon}</span>}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-[var(--color-ink)]">{value}</div>
      {hint && <div className="mt-1 text-xs text-[var(--color-ink-muted)]">{hint}</div>}
    </div>
  );
}

const ICON_TONE: Record<string, string> = {
  neutral: "bg-[var(--color-neutral-soft)] text-[var(--color-ink-muted)]",
  success: "bg-[var(--color-success-soft)] text-[var(--color-success)]",
  warning: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
  danger: "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
  accent: "bg-[var(--color-accent-soft)] text-[var(--color-accent)]",
};
