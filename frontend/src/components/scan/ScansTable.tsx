import { useNavigate } from "react-router-dom";
import { Radar } from "lucide-react";
import { Table, THead, TBody, Tr, Th, Td } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { ScanStatusBadge } from "@/components/ui/StatusBadge";
import { formatDate, formatDuration, formatNumber, scoreTone } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Business, ScanSummary } from "@/lib/types";

export function ScansTable({
  scans,
  businessMap,
  emptyTitle = "No scans yet",
  emptyDescription = "Start your first GEO scan to analyze visibility across AI platforms.",
}: {
  scans: ScanSummary[];
  businessMap?: Record<string, Business>;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const navigate = useNavigate();

  if (scans.length === 0) {
    return <EmptyState icon={<Radar className="h-5 w-5" />} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <Table>
      <THead>
        <Tr>
          <Th>Scan</Th>
          {businessMap && <Th>Business</Th>}
          <Th>Status</Th>
          <Th>GEO score</Th>
          <Th>Questions</Th>
          <Th>Responses</Th>
          <Th>Started</Th>
          <Th>Duration</Th>
        </Tr>
      </THead>
      <TBody>
        {scans.map((scan) => {
          const business = businessMap?.[scan.businessId];
          const score = scan.geoScore?.total ?? null;
          const tone = scoreTone(score);
          return (
            <Tr key={scan.id} clickable onClick={() => navigate(`/scans/${scan.id}`)}>
              <Td className="font-mono text-xs text-[var(--color-ink-muted)]">{scan.id.replace("scan_", "").slice(0, 8)}</Td>
              {businessMap && <Td className="font-medium">{business?.companyName ?? "—"}</Td>}
              <Td>
                <ScanStatusBadge status={scan.status} />
              </Td>
              <Td>
                {score === null ? (
                  <span className="text-[var(--color-ink-faint)]">—</span>
                ) : (
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      tone === "success" && "text-[var(--color-success)]",
                      tone === "warning" && "text-[var(--color-warning)]",
                      tone === "danger" && "text-[var(--color-danger)]",
                    )}
                  >
                    {Math.round(score)}
                  </span>
                )}
              </Td>
              <Td>{formatNumber(scan.statistics?.totalQuestions ?? scan.options.questionCount)}</Td>
              <Td>
                {scan.statistics ? (
                  <span>
                    <span className="text-[var(--color-success)]">{scan.statistics.successfulResponses}</span>
                    {" / "}
                    <span className={scan.statistics.failedResponses > 0 ? "text-[var(--color-danger)]" : "text-[var(--color-ink-faint)]"}>
                      {scan.statistics.failedResponses}
                    </span>
                  </span>
                ) : (
                  "—"
                )}
              </Td>
              <Td className="whitespace-nowrap text-[var(--color-ink-muted)]">{formatDate(scan.startedAt)}</Td>
              <Td className="text-[var(--color-ink-muted)]">{formatDuration(scan.statistics?.durationMs ?? null)}</Td>
            </Tr>
          );
        })}
      </TBody>
    </Table>
  );
}
