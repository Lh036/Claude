import { useMemo, useState } from "react";
import { HelpCircle, MessageSquareText } from "lucide-react";
import { Table, THead, TBody, Tr, Th, Td } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { PriorityBadge } from "@/components/ui/StatusBadge";
import { FieldWrap, Select } from "@/components/ui/Field";
import { QUESTION_CATEGORY_LABELS } from "@/lib/format";
import type { GeneratedQuestion } from "@/lib/types";

export function QuestionsPanel({
  questions,
  onViewResponses,
}: {
  questions: GeneratedQuestion[];
  onViewResponses: (questionId: string) => void;
}) {
  const [category, setCategory] = useState("");

  const categories = useMemo(() => Array.from(new Set(questions.map((q) => q.category))), [questions]);
  const filtered = category ? questions.filter((q) => q.category === category) : questions;

  if (questions.length === 0) {
    return (
      <EmptyState
        icon={<HelpCircle className="h-5 w-5" />}
        title="No questions generated yet"
        description="Questions appear here once the question generation stage completes."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="max-w-xs">
        <FieldWrap label="Category">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories ({questions.length})</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {QUESTION_CATEGORY_LABELS[c] ?? c} ({questions.filter((q) => q.category === c).length})
              </option>
            ))}
          </Select>
        </FieldWrap>
      </div>

      <Table>
        <THead>
          <Tr>
            <Th className="w-1/2">Question</Th>
            <Th>Category</Th>
            <Th>Intent</Th>
            <Th>Priority</Th>
            <Th>Location</Th>
            <Th>Status</Th>
            <Th />
          </Tr>
        </THead>
        <TBody>
          {filtered.map((q) => (
            <Tr key={q.id} clickable onClick={() => onViewResponses(q.id)}>
              <Td>
                <div className="font-medium text-[var(--color-ink)]">{q.question}</div>
                <div className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{q.reason}</div>
              </Td>
              <Td>
                <Badge tone="accent">{QUESTION_CATEGORY_LABELS[q.category] ?? q.category}</Badge>
              </Td>
              <Td className="capitalize text-[var(--color-ink-muted)]">{q.intent}</Td>
              <Td>
                <PriorityBadge priority={q.priority} />
              </Td>
              <Td className="text-[var(--color-ink-muted)]">{q.location ?? "—"}</Td>
              <Td>
                {q.valid ? (
                  <Badge tone="success">Valid</Badge>
                ) : (
                  <Badge tone="neutral" title={q.invalidReason}>
                    Dropped
                  </Badge>
                )}
              </Td>
              <Td>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewResponses(q.id);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] hover:underline"
                >
                  <MessageSquareText className="h-3.5 w-3.5" />
                  View answers
                </button>
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
