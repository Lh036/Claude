import { ShieldCheck, AlertOctagon } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { formatDate, PROVIDER_LABELS } from "@/lib/format";
import type { ScanError, ProviderName } from "@/lib/types";

export function ScanErrorsPanel({ errors }: { errors: ScanError[] }) {
  if (errors.length === 0) {
    return (
      <EmptyState
        icon={<ShieldCheck className="h-5 w-5" />}
        title="No errors recorded"
        description="Every AI request and pipeline stage in this scan completed without error."
      />
    );
  }

  return (
    <div className="space-y-2">
      {errors.map((err, i) => (
        <div key={i} className="flex items-start gap-3 rounded-lg border border-[var(--color-danger-soft)] bg-[var(--color-danger-soft)]/50 px-4 py-3">
          <AlertOctagon className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--color-danger)]" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-ink-muted)]">
              <span>{formatDate(err.timestamp)}</span>
              <Badge tone="neutral">{err.stage}</Badge>
              {err.provider && <Badge tone="accent">{PROVIDER_LABELS[err.provider as ProviderName] ?? err.provider}</Badge>}
              {err.questionId && <span className="font-mono">{err.questionId.slice(0, 12)}…</span>}
            </div>
            <p className="mt-1 text-sm text-[var(--color-ink)]">{err.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
