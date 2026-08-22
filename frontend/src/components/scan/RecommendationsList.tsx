import { Lightbulb, TriangleAlert, Eye, ArrowRight } from "lucide-react";
import { PriorityBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Recommendation } from "@/lib/types";
import { cn } from "@/lib/cn";

export function RecommendationsList({ recommendations }: { recommendations: Recommendation[] }) {
  if (recommendations.length === 0) {
    return (
      <EmptyState
        icon={<Lightbulb className="h-5 w-5" />}
        title="No recommendations yet"
        description="Recommendations are generated from the scan's actual results once analysis completes."
      />
    );
  }

  return (
    <div className="space-y-3">
      {recommendations.map((rec) => (
        <div
          key={rec.id}
          className={cn(
            "rounded-xl border bg-white p-4",
            rec.priority === "high" ? "border-red-200" : rec.priority === "medium" ? "border-amber-200" : "border-[var(--color-border)]",
          )}
        >
          <div className="mb-2 flex items-center justify-between">
            <PriorityBadge priority={rec.priority} />
          </div>
          <div className="space-y-2.5 text-sm">
            <div className="flex gap-2">
              <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--color-danger)]" />
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Problem</div>
                <p className="text-[var(--color-ink)]">{rec.problem}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Eye className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--color-ink-faint)]" />
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Observation</div>
                <p className="text-[var(--color-ink-muted)]">{rec.observation}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <ArrowRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--color-accent)]" />
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Recommendation</div>
                <p className="font-medium text-[var(--color-ink)]">{rec.recommendation}</p>
              </div>
            </div>
          </div>
          {rec.evidenceResponseIds.length > 0 && (
            <p className="mt-3 text-xs text-[var(--color-ink-faint)]">
              Based on {rec.evidenceResponseIds.length} AI response{rec.evidenceResponseIds.length === 1 ? "" : "s"} from this scan.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
