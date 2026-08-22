import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Table, THead, TBody, Tr, Th, Td } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDuration, formatNumber, formatOrdinal, formatPercent, PROVIDER_LABELS } from "@/lib/format";
import type { ProviderPerformance } from "@/lib/types";
import { BarChart3 } from "lucide-react";

export function ProviderMentionChart({ perProvider }: { perProvider: ProviderPerformance[] }) {
  if (perProvider.length === 0) {
    return <EmptyState icon={<BarChart3 className="h-5 w-5" />} title="No provider data yet" />;
  }

  const data = perProvider.map((p) => ({
    name: PROVIDER_LABELS[p.provider] ?? p.provider,
    "Mention rate": Math.round(p.mentionRate * 100),
    "Recommendation rate": Math.round(p.recommendationRate * 100),
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: "var(--color-ink-muted)" }} axisLine={{ stroke: "var(--color-border)" }} tickLine={false} />
          <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 12, fill: "var(--color-ink-muted)" }} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(value: number) => `${value}%`}
            contentStyle={{ borderRadius: 8, borderColor: "var(--color-border)", fontSize: 13 }}
          />
          <Bar dataKey="Mention rate" fill="var(--color-accent)" radius={[4, 4, 0, 0]} maxBarSize={48} />
          <Bar dataKey="Recommendation rate" fill="var(--color-running)" radius={[4, 4, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ProviderComparisonTable({ perProvider }: { perProvider: ProviderPerformance[] }) {
  if (perProvider.length === 0) {
    return <EmptyState icon={<BarChart3 className="h-5 w-5" />} title="No provider data yet" description="Provider comparison appears once a scan has queried at least one AI provider." />;
  }

  return (
    <Table>
      <THead>
        <Tr>
          <Th>Provider</Th>
          <Th>Responses</Th>
          <Th>Successful</Th>
          <Th>Failed</Th>
          <Th>Mention rate</Th>
          <Th>Avg. position</Th>
          <Th>Recommendation rate</Th>
          <Th>Competitors seen</Th>
        </Tr>
      </THead>
      <TBody>
        {perProvider.map((p) => (
          <Tr key={p.provider}>
            <Td className="font-medium">{PROVIDER_LABELS[p.provider] ?? p.provider}</Td>
            <Td>{formatNumber(p.totalQuestions)}</Td>
            <Td className="text-[var(--color-success)]">{formatNumber(p.successfulResponses)}</Td>
            <Td className={p.failedResponses > 0 ? "text-[var(--color-danger)]" : undefined}>{formatNumber(p.failedResponses)}</Td>
            <Td className="font-medium">{formatPercent(p.mentionRate)}</Td>
            <Td>{p.averagePosition === null ? "—" : formatOrdinal(Math.round(p.averagePosition))}</Td>
            <Td>{formatPercent(p.recommendationRate)}</Td>
            <Td>{formatNumber(p.uniqueCompetitorsSeen)}</Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}

export function providerAvgDuration(durationsMs: number[]): string {
  if (durationsMs.length === 0) return "—";
  return formatDuration(durationsMs.reduce((a, b) => a + b, 0) / durationsMs.length);
}
