import { Badge, type BadgeTone } from "./Badge";
import { SCAN_STATUS_LABELS } from "@/lib/format";
import type { ScanStatus } from "@/lib/types";

const STATUS_TONE: Record<ScanStatus, BadgeTone> = {
  pending: "neutral",
  running: "running",
  completed: "success",
  partial: "warning",
  failed: "danger",
};

export function ScanStatusBadge({ status }: { status: ScanStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]} dot>
      {SCAN_STATUS_LABELS[status]}
    </Badge>
  );
}

const LOG_LEVEL_TONE: Record<string, BadgeTone> = {
  DEBUG: "neutral",
  INFO: "running",
  SUCCESS: "success",
  WARNING: "warning",
  ERROR: "danger",
};

export function LogLevelBadge({ level }: { level: string }) {
  return (
    <Badge tone={LOG_LEVEL_TONE[level] ?? "neutral"} className="font-mono uppercase tracking-wide">
      {level}
    </Badge>
  );
}

const PRIORITY_TONE: Record<string, BadgeTone> = {
  high: "danger",
  medium: "warning",
  low: "neutral",
};

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <Badge tone={PRIORITY_TONE[priority] ?? "neutral"} className="uppercase tracking-wide">
      {priority}
    </Badge>
  );
}
