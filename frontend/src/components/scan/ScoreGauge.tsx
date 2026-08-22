import { scoreTone } from "@/lib/format";
import { cn } from "@/lib/cn";

const TONE_COLOR: Record<string, string> = {
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger)",
  neutral: "var(--color-ink-faint)",
};

export function ScoreGauge({ score, size = 120, label = "GEO Score" }: { score: number | null; size?: number; label?: string }) {
  const tone = scoreTone(score);
  const color = TONE_COLOR[tone];
  const pct = score ?? 0;
  const track = "var(--color-neutral-soft)";

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative flex items-center justify-center rounded-full"
        style={{
          width: size,
          height: size,
          background: `conic-gradient(${color} ${pct * 3.6}deg, ${track} 0deg)`,
        }}
      >
        <div
          className="absolute rounded-full bg-white"
          style={{ width: size - 18, height: size - 18 }}
        />
        <div className="relative flex flex-col items-center">
          <span className={cn("text-2xl font-bold tabular-nums", score === null && "text-[var(--color-ink-faint)]")}>
            {score === null ? "—" : Math.round(score)}
          </span>
          {score !== null && <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">/ 100</span>}
        </div>
      </div>
      <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-muted)]">{label}</span>
    </div>
  );
}
