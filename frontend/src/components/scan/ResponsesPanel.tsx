import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, MessagesSquare, Eye, EyeOff } from "lucide-react";
import { FieldWrap, Select } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate, formatDuration, formatOrdinal, PROVIDER_LABELS, truncate } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { AIResponse, GeneratedQuestion, ProviderName, ResponseAnalysis } from "@/lib/types";
import { ALL_PROVIDERS } from "@/lib/types";

export function ResponsesPanel({
  responses,
  analyses,
  questions,
  questionFilter,
  onQuestionFilterChange,
}: {
  responses: AIResponse[];
  analyses: ResponseAnalysis[];
  questions: GeneratedQuestion[];
  questionFilter: string;
  onQuestionFilterChange: (questionId: string) => void;
}) {
  const [provider, setProvider] = useState("");
  const [status, setStatus] = useState("");
  const [mentioned, setMentioned] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const analysisByResponse = useMemo(() => new Map(analyses.map((a) => [a.responseId, a])), [analyses]);
  const questionsById = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);

  const filtered = useMemo(() => {
    return responses.filter((r) => {
      if (provider && r.provider !== provider) return false;
      if (status && r.status !== status) return false;
      if (questionFilter && r.questionId !== questionFilter) return false;
      if (mentioned) {
        const a = analysisByResponse.get(r.id);
        const isMentioned = a?.mention.mentioned ?? false;
        if (mentioned === "mentioned" && !isMentioned) return false;
        if (mentioned === "not_mentioned" && isMentioned) return false;
      }
      return true;
    });
  }, [responses, provider, status, questionFilter, mentioned, analysisByResponse]);

  if (responses.length === 0) {
    return (
      <EmptyState
        icon={<MessagesSquare className="h-5 w-5" />}
        title="No AI responses yet"
        description="Responses appear here as each provider answers the generated questions."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <FieldWrap label="Provider">
          <Select value={provider} onChange={(e) => setProvider(e.target.value)}>
            <option value="">All providers</option>
            {ALL_PROVIDERS.concat("mock" as ProviderName).map((p) => (
              <option key={p} value={p}>
                {PROVIDER_LABELS[p]}
              </option>
            ))}
          </Select>
        </FieldWrap>
        <FieldWrap label="Question">
          <Select value={questionFilter} onChange={(e) => onQuestionFilterChange(e.target.value)}>
            <option value="">All questions</option>
            {questions.map((q) => (
              <option key={q.id} value={q.id}>
                {truncate(q.question, 60)}
              </option>
            ))}
          </Select>
        </FieldWrap>
        <FieldWrap label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </Select>
        </FieldWrap>
        <FieldWrap label="Mentioned">
          <Select value={mentioned} onChange={(e) => setMentioned(e.target.value)}>
            <option value="">Mentioned or not</option>
            <option value="mentioned">Mentioned</option>
            <option value="not_mentioned">Not mentioned</option>
          </Select>
        </FieldWrap>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<MessagesSquare className="h-5 w-5" />} title="No responses match your filters" />
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const analysis = analysisByResponse.get(r.id);
            const question = questionsById.get(r.questionId);
            const isOpen = expanded === r.id;
            return (
              <div key={r.id} className="rounded-xl border border-[var(--color-border)] bg-white">
                <button
                  onClick={() => setExpanded(isOpen ? null : r.id)}
                  className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="accent">{PROVIDER_LABELS[r.provider]}</Badge>
                      <span className="font-mono text-xs text-[var(--color-ink-faint)]">{r.model}</span>
                      {r.status === "success" ? (
                        <Badge tone="success">Success</Badge>
                      ) : (
                        <Badge tone="danger">Failed{r.error ? ` — ${r.error.kind}` : ""}</Badge>
                      )}
                      {analysis?.mention.mentioned ? (
                        <Badge tone="success" dot>
                          <Eye className="h-3 w-3" /> Mentioned
                          {analysis.position.hasRanking && analysis.position.position
                            ? ` (${formatOrdinal(analysis.position.position)})`
                            : ""}
                        </Badge>
                      ) : r.status === "success" ? (
                        <Badge tone="neutral">
                          <EyeOff className="h-3 w-3" /> Not mentioned
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1.5 truncate text-sm font-medium text-[var(--color-ink)]">{question?.question ?? r.question}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">
                      {formatDate(r.timestamp)} · {formatDuration(r.durationMs)}
                      {r.attempt > 1 ? ` · attempt ${r.attempt}` : ""}
                    </p>
                  </div>
                  {isOpen ? <ChevronUp className="h-4 w-4 flex-shrink-0 text-[var(--color-ink-faint)]" /> : <ChevronDown className="h-4 w-4 flex-shrink-0 text-[var(--color-ink-faint)]" />}
                </button>

                {isOpen && (
                  <div className="border-t border-[var(--color-border)] px-4 py-3">
                    {r.status === "success" ? (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-ink)]">{r.answer}</p>
                    ) : (
                      <div className={cn("rounded-lg border border-[var(--color-danger-soft)] bg-[var(--color-danger-soft)] p-3 text-sm")}>
                        <div className="font-medium text-[var(--color-danger)]">
                          {r.error?.kind ?? "unknown"} error
                        </div>
                        <p className="mt-1 text-[var(--color-ink)]">{r.error?.message}</p>
                        <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                          {r.error?.retryable ? "This error is retryable — the queue retried automatically." : "This error was not retried (permanent failure)."}{" "}
                          Final attempt: {r.attempt}.
                        </p>
                      </div>
                    )}

                    {analysis && r.status === "success" && (
                      <>
                        <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-[var(--color-ink-muted)] sm:grid-cols-4">
                          <div>
                            <div className="font-semibold text-[var(--color-ink-faint)]">Occurrences</div>
                            {analysis.mention.occurrences}
                          </div>
                          <div>
                            <div className="font-semibold text-[var(--color-ink-faint)]">Recommended</div>
                            {analysis.mention.recommended ? "Yes" : "No"}
                          </div>
                          <div>
                            <div className="font-semibold text-[var(--color-ink-faint)]">Ranking</div>
                            {analysis.position.hasRanking
                              ? `${analysis.position.position ? formatOrdinal(analysis.position.position) : "unranked"} of ${analysis.position.totalCompaniesMentioned}`
                              : "No explicit ranking"}
                          </div>
                          <div>
                            <div className="font-semibold text-[var(--color-ink-faint)]">Competitors detected</div>
                            {analysis.competitorsDetected.length}
                          </div>
                        </div>

                        {analysis.mention.mentioned && (
                          <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs">
                            <div className="mb-1.5 font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Mention context</div>
                            {analysis.context.surroundingText && (
                              <p className="mb-2 italic text-[var(--color-ink-muted)]">"{analysis.context.surroundingText}"</p>
                            )}
                            <div className="flex flex-wrap gap-3">
                              {analysis.context.strengths.length > 0 && (
                                <span>
                                  <span className="font-medium text-[var(--color-success)]">Strengths:</span> {analysis.context.strengths.join(", ")}
                                </span>
                              )}
                              {analysis.context.weaknesses.length > 0 && (
                                <span>
                                  <span className="font-medium text-[var(--color-danger)]">Weaknesses:</span> {analysis.context.weaknesses.join(", ")}
                                </span>
                              )}
                              {analysis.context.servicesM.length > 0 && (
                                <span>
                                  <span className="font-medium text-[var(--color-ink)]">Services:</span> {analysis.context.servicesM.join(", ")}
                                </span>
                              )}
                            </div>
                            {analysis.mention.matchedVariants.length > 0 && (
                              <p className="mt-1.5 text-[var(--color-ink-faint)]">Matched as: {analysis.mention.matchedVariants.join(", ")}</p>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
