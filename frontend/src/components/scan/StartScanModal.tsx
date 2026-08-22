import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Rocket } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FieldWrap, Select } from "@/components/ui/Field";
import { InlineError } from "@/components/ui/ErrorState";
import { businessApi, scanApi, ApiError } from "@/lib/api";
import { loadSettings } from "@/lib/settings";
import { PROVIDER_LABELS, formatNumber } from "@/lib/format";
import { ALL_PROVIDERS, QUESTION_COUNT_OPTIONS, type ProviderName } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";

export function StartScanModal({
  open,
  onClose,
  initialBusinessId,
}: {
  open: boolean;
  onClose: () => void;
  initialBusinessId?: string;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { notify } = useToast();
  const settings = useMemo(() => loadSettings(), [open]);

  const [businessId, setBusinessId] = useState(initialBusinessId ?? "");
  const [questionCount, setQuestionCount] = useState<number>(settings.defaultQuestionCount);
  const [providers, setProviders] = useState<ProviderName[]>(settings.defaultProviders);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setBusinessId(initialBusinessId ?? "");
      setQuestionCount(settings.defaultQuestionCount);
      setProviders(settings.defaultProviders);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialBusinessId]);

  const businessesQuery = useQuery({
    queryKey: ["businesses"],
    queryFn: businessApi.list,
    enabled: open && !initialBusinessId,
  });

  const selectedBusinessQuery = useQuery({
    queryKey: ["business", initialBusinessId],
    queryFn: () => businessApi.get(initialBusinessId as string),
    enabled: open && !!initialBusinessId,
  });

  const mutation = useMutation({
    mutationFn: scanApi.create,
    onSuccess: (scan) => {
      queryClient.invalidateQueries({ queryKey: ["scans"] });
      queryClient.invalidateQueries({ queryKey: ["businessScans", scan.businessId] });
      notify("success", "Scan started — following live progress.");
      onClose();
      navigate(`/scans/${scan.id}`);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Could not start the scan. Please try again.");
    },
  });

  function toggleProvider(p: ProviderName) {
    setProviders((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  function submit() {
    setError(null);
    if (!businessId) {
      setError("Select a business to scan.");
      return;
    }
    if (providers.length === 0) {
      setError("Select at least one AI provider.");
      return;
    }
    mutation.mutate({ businessId, questionCount, providers });
  }

  const selectedBusiness = initialBusinessId
    ? selectedBusinessQuery.data
    : businessesQuery.data?.find((b) => b.id === businessId);

  const estimatedRequests = questionCount * providers.length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Start new GEO scan"
      subtitle="Configure how the AI Query Engine analyzes this business."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={mutation.isPending} icon={<Rocket className="h-4 w-4" />}>
            Start scan
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!initialBusinessId && (
          <FieldWrap label="Business" required>
            <Select value={businessId} onChange={(e) => setBusinessId(e.target.value)} disabled={businessesQuery.isLoading}>
              <option value="">
                {businessesQuery.isLoading ? "Loading businesses…" : "Select a business…"}
              </option>
              {businessesQuery.data?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.companyName}
                </option>
              ))}
            </Select>
            {businessesQuery.data?.length === 0 && (
              <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                No businesses yet — add one first from the Businesses page.
              </p>
            )}
          </FieldWrap>
        )}

        {selectedBusiness && (
          <div className="rounded-lg border border-[var(--color-border)] bg-slate-50 px-3 py-2.5 text-sm">
            <div className="font-medium text-[var(--color-ink)]">{selectedBusiness.companyName}</div>
            <div className="text-xs text-[var(--color-ink-muted)]">{selectedBusiness.website ?? "No website on file"}</div>
          </div>
        )}

        <FieldWrap label="Number of questions" required hint="How many GEO questions to generate and query across every selected provider.">
          <Select value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))}>
            {QUESTION_COUNT_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} questions
              </option>
            ))}
          </Select>
        </FieldWrap>

        <FieldWrap label="AI providers" required hint="Each selected provider is queried for every generated question.">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {ALL_PROVIDERS.map((p) => (
              <label
                key={p}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--color-border-strong)] px-3 py-2 text-sm has-[:checked]:border-[var(--color-accent)] has-[:checked]:bg-[var(--color-accent-soft)]"
              >
                <input
                  type="checkbox"
                  checked={providers.includes(p)}
                  onChange={() => toggleProvider(p)}
                  className="h-4 w-4 accent-[var(--color-accent)]"
                />
                {PROVIDER_LABELS[p]}
              </label>
            ))}
          </div>
        </FieldWrap>

        <div className="rounded-lg border border-[var(--color-border)] bg-white px-4 py-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Scan summary</div>
          <dl className="grid grid-cols-2 gap-y-1.5 text-sm">
            <dt className="text-[var(--color-ink-muted)]">Business</dt>
            <dd className="text-right font-medium text-[var(--color-ink)]">{selectedBusiness?.companyName ?? "—"}</dd>
            <dt className="text-[var(--color-ink-muted)]">Questions</dt>
            <dd className="text-right font-medium text-[var(--color-ink)]">{formatNumber(questionCount)}</dd>
            <dt className="text-[var(--color-ink-muted)]">Providers</dt>
            <dd className="text-right font-medium text-[var(--color-ink)]">{providers.length}</dd>
            <dt className="text-[var(--color-ink-muted)]">Estimated AI requests</dt>
            <dd className="text-right font-medium text-[var(--color-ink)]">{formatNumber(estimatedRequests)}</dd>
          </dl>
          <p className="mt-2 text-xs text-[var(--color-ink-faint)]">
            Actual cost is calculated per response from real token usage after the scan runs — see the scan's Overview tab once complete.
          </p>
        </div>

        {error && <InlineError message={error} />}
      </div>
    </Modal>
  );
}
