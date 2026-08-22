import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Building2, Globe, MapPin, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { ScanStatusBadge } from "@/components/ui/StatusBadge";
import { AddBusinessModal } from "@/components/business/AddBusinessModal";
import { businessApi, scanApi } from "@/lib/api";
import { formatDate, formatRelative, scoreTone } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { ScanSummary } from "@/lib/types";

export default function BusinessesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const businessesQuery = useQuery({ queryKey: ["businesses"], queryFn: businessApi.list });
  const scansQuery = useQuery({ queryKey: ["scans", { limit: 500 }], queryFn: () => scanApi.list({ limit: 500 }) });

  const perBusiness = useMemo(() => {
    const map = new Map<string, { count: number; latest: ScanSummary | null }>();
    for (const scan of scansQuery.data ?? []) {
      const entry = map.get(scan.businessId) ?? { count: 0, latest: null };
      entry.count += 1;
      if (!entry.latest || new Date(scan.createdAt) > new Date(entry.latest.createdAt)) entry.latest = scan;
      map.set(scan.businessId, entry);
    }
    return map;
  }, [scansQuery.data]);

  const filtered = (businessesQuery.data ?? []).filter((b) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return b.companyName.toLowerCase().includes(q) || b.industry?.toLowerCase().includes(q) || b.location?.toLowerCase().includes(q);
  });

  return (
    <div>
      <PageHeader
        title="Businesses"
        subtitle="Every business tracked in the GEO system."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setAddOpen(true)}>
            Add business
          </Button>
        }
      />

      <div className="mb-5 max-w-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-[var(--color-ink-faint)]" />
          <Input className="pl-8" placeholder="Search businesses…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {businessesQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : businessesQuery.isError ? (
        <ErrorState message="Could not load businesses." onRetry={() => businessesQuery.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-5 w-5" />}
          title={businessesQuery.data?.length === 0 ? "No businesses yet" : "No businesses match your search"}
          description={businessesQuery.data?.length === 0 ? "Add your first business to start running GEO scans." : undefined}
          action={
            businessesQuery.data?.length === 0 ? (
              <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setAddOpen(true)}>
                Add business
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((business) => {
            const info = perBusiness.get(business.id);
            const score = info?.latest?.geoScore?.total ?? null;
            const tone = scoreTone(score);
            return (
              <button
                key={business.id}
                onClick={() => navigate(`/businesses/${business.id}`)}
                className="flex flex-col items-start rounded-xl border border-[var(--color-border)] bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex w-full items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[var(--color-ink)]">{business.companyName}</h3>
                  {score !== null && (
                    <span
                      className={cn(
                        "flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                        tone === "success" && "bg-[var(--color-success-soft)] text-[var(--color-success)]",
                        tone === "warning" && "bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
                        tone === "danger" && "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
                      )}
                    >
                      {Math.round(score)}
                    </span>
                  )}
                </div>

                <div className="mt-2 space-y-1 text-xs text-[var(--color-ink-muted)]">
                  {business.website && (
                    <div className="flex items-center gap-1.5 truncate">
                      <Globe className="h-3.5 w-3.5 flex-shrink-0" /> <span className="truncate">{business.website}</span>
                    </div>
                  )}
                  {(business.industry || business.location) && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                      {[business.industry, business.location].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex w-full items-center justify-between border-t border-[var(--color-border)] pt-3 text-xs">
                  <span className="text-[var(--color-ink-faint)]">
                    {info?.count ? `${info.count} scan${info.count === 1 ? "" : "s"}` : "No scans yet"}
                  </span>
                  {info?.latest ? (
                    <span className="flex items-center gap-1.5">
                      <ScanStatusBadge status={info.latest.status} />
                      <span className="text-[var(--color-ink-faint)]" title={formatDate(info.latest.createdAt)}>
                        {formatRelative(info.latest.createdAt)}
                      </span>
                    </span>
                  ) : (
                    <span className="text-[var(--color-ink-faint)]">—</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <AddBusinessModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={(b) => navigate(`/businesses/${b.id}`)} />
    </div>
  );
}
