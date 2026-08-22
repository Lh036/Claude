import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border-strong)] bg-white px-6 py-14 text-center">
      {icon && <div className="mb-3 rounded-full bg-[var(--color-neutral-soft)] p-3 text-[var(--color-ink-faint)]">{icon}</div>}
      <h3 className="text-sm font-semibold text-[var(--color-ink)]">{title}</h3>
      {description && <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--color-ink-muted)]">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
