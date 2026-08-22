import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { FieldWrap, Input, Select } from "@/components/ui/Field";
import { ScansTable } from "@/components/scan/ScansTable";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { scanApi } from "@/lib/api";
import { useBusinessMap } from "@/hooks/useBusinessMap";
import type { ProviderName, ScanStatus } from "@/lib/types";
import { SCAN_STATUS_LABELS, PROVIDER_LABELS } from "@/lib/format";
import { ALL_PROVIDERS } from "@/lib/types";
import { SearchX } from "lucide-react";

const STATUS_OPTIONS: ScanStatus[] = ["pending", "running", "completed", "partial", "failed"];

export default function ScansPage() {
  const [params, setParams] = useSearchParams();
  const businessId = params.get("businessId") ?? "";
  const status = (params.get("status") as ScanStatus) || "";
  const provider = params.get("provider") ?? "";
  const [search, setSearch] = useState(params.get("q") ?? "");

  const businessMap = useBusinessMap();

  const scansQuery = useQuery({
    queryKey: ["scans", { businessId, status }],
    queryFn: () => scanApi.list({ businessId: businessId || undefined, status: status || undefined, limit: 300 }),
  });

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  const filtered = useMemo(() => {
    let scans = scansQuery.data ?? [];
    if (provider) {
      scans = scans.filter((s) => s.options.providers.includes(provider as ProviderName));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      scans = scans.filter((s) => {
        const business = businessMap.map[s.businessId];
        return s.id.toLowerCase().includes(q) || business?.companyName.toLowerCase().includes(q);
      });
    }
    return scans;
  }, [scansQuery.data, provider, search, businessMap.map]);

  const hasActiveFilters = !!(businessId || status || provider || search.trim());

  return (
    <div>
      <PageHeader title="Scans" subtitle="Every GEO scan across all businesses." />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <FieldWrap label="Search">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-[var(--color-ink-faint)]" />
            <Input className="pl-8" placeholder="Scan ID or business…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </FieldWrap>
        <FieldWrap label="Business">
          <Select value={businessId} onChange={(e) => updateParam("businessId", e.target.value)}>
            <option value="">All businesses</option>
            {businessMap.data?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.companyName}
              </option>
            ))}
          </Select>
        </FieldWrap>
        <FieldWrap label="Status">
          <Select value={status} onChange={(e) => updateParam("status", e.target.value)}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {SCAN_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </FieldWrap>
        <FieldWrap label="Provider">
          <Select value={provider} onChange={(e) => updateParam("provider", e.target.value)}>
            <option value="">All providers</option>
            {ALL_PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {PROVIDER_LABELS[p]}
              </option>
            ))}
          </Select>
        </FieldWrap>
      </div>

      {scansQuery.isLoading ? (
        <SkeletonTable rows={8} cols={8} />
      ) : scansQuery.isError ? (
        <ErrorState message="Could not load scans." onRetry={() => scansQuery.refetch()} />
      ) : filtered.length === 0 && hasActiveFilters ? (
        <EmptyState icon={<SearchX className="h-5 w-5" />} title="No scans match your filters" description="Try clearing a filter or searching for something else." />
      ) : (
        <ScansTable scans={filtered} businessMap={businessMap.map} />
      )}
    </div>
  );
}
