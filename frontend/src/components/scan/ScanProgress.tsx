import { Check, CircleDashed, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Scan, ScanError, ScanStage } from "@/lib/types";

const STAGE_ORDER: ScanStage[] = [
  "created",
  "research",
  "question_generation",
  "question_validation",
  "ai_querying",
  "response_analysis",
  "competitor_detection",
  "cross_model_analysis",
  "scoring",
  "recommendations",
  "done",
];

const STAGE_LABELS: Record<ScanStage, string> = {
  created: "Scan created",
  research: "Business research",
  question_generation: "Generating GEO questions",
  question_validation: "Validating questions",
  ai_querying: "Querying AI providers",
  response_analysis: "Analyzing responses",
  competitor_detection: "Detecting competitors",
  cross_model_analysis: "Cross-model comparison",
  scoring: "Calculating GEO score",
  recommendations: "Generating recommendations",
  done: "Finalizing scan",
};

type StepState = "done" | "current" | "pending" | "error" | "warning";

interface Step {
  stage: ScanStage;
  state: StepState;
}

/**
 * Derives the checklist strictly from real backend signals:
 * - `scan.stage` for how far the orchestrator has progressed.
 * - `scan.errors[].stage` to tell an early hard failure (e.g. "no valid questions",
 *   where the pipeline genuinely never reached later stages) apart from a scan
 *   that ran to completion but had some failed AI requests along the way
 *   (status "partial"/"failed" with statistics present — every stage did run).
 * No stage is ever marked "done" that the backend didn't actually reach.
 */
function computeSteps(scan: Scan, hasStatistics: boolean): Step[] {
  const currentIndex = STAGE_ORDER.indexOf(scan.stage);
  const earlyFailure = scan.status === "failed" && !hasStatistics && scan.errors.length > 0;
  const failureStage = earlyFailure ? scan.errors[0]?.stage : undefined;
  const failureIndex = failureStage ? STAGE_ORDER.indexOf(failureStage) : -1;
  const errorStages = new Set(scan.errors.map((e: ScanError) => e.stage));

  const ranToCompletion = scan.status === "completed" || scan.status === "partial" || (scan.status === "failed" && hasStatistics);

  return STAGE_ORDER.map((stage, i) => {
    if (earlyFailure) {
      if (i === failureIndex) return { stage, state: "error" as const };
      if (i > failureIndex) return { stage, state: "pending" as const };
      return { stage, state: "done" as const };
    }

    if (ranToCompletion) {
      const state: StepState = errorStages.has(stage) ? "warning" : "done";
      return { stage, state };
    }

    // Still running (or pending / not yet started).
    if (i < currentIndex) {
      const state: StepState = errorStages.has(stage) ? "warning" : "done";
      return { stage, state };
    }
    if (i === currentIndex) return { stage, state: "current" as const };
    return { stage, state: "pending" as const };
  });
}

export function ScanProgress({ scan, hasStatistics }: { scan: Scan; hasStatistics: boolean }) {
  const steps = computeSteps(scan, hasStatistics);

  return (
    <ol className="space-y-1">
      {steps.map(({ stage, state }) => (
        <li key={stage} className="flex items-center gap-3 rounded-lg px-2 py-1.5">
          <StepIcon state={state} />
          <span
            className={cn(
              "text-sm",
              state === "done" && "text-[var(--color-ink-muted)]",
              state === "current" && "font-medium text-[var(--color-accent)]",
              state === "pending" && "text-[var(--color-ink-faint)]",
              state === "error" && "font-medium text-[var(--color-danger)]",
              state === "warning" && "text-[var(--color-ink)]",
            )}
          >
            {STAGE_LABELS[stage]}
          </span>
          {state === "warning" && (
            <span className="text-xs text-[var(--color-warning)]">— completed with errors</span>
          )}
        </li>
      ))}
    </ol>
  );
}

function StepIcon({ state }: { state: StepState }) {
  if (state === "done") return <Check className="h-4 w-4 flex-shrink-0 text-[var(--color-success)]" />;
  if (state === "current") return <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-[var(--color-accent)]" />;
  if (state === "error") return <AlertTriangle className="h-4 w-4 flex-shrink-0 text-[var(--color-danger)]" />;
  if (state === "warning") return <AlertTriangle className="h-4 w-4 flex-shrink-0 text-[var(--color-warning)]" />;
  return <CircleDashed className="h-4 w-4 flex-shrink-0 text-[var(--color-ink-faint)]" />;
}
