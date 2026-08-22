import { useQuery } from "@tanstack/react-query";
import { scanApi } from "@/lib/api";
import type { ScanStatus } from "@/lib/types";

const ACTIVE_STATUSES: ScanStatus[] = ["pending", "running"];
const POLL_INTERVAL_MS = 2000;

/**
 * Polls GET /api/scans/:id/status while the scan is pending/running, and stops
 * automatically once it settles (completed/partial/failed) — the "regularly
 * refresh via polling, stop when done" behavior the scan detail/run pages need.
 */
export function useScanStatus(scanId: string | undefined) {
  return useQuery({
    queryKey: ["scanStatus", scanId],
    queryFn: () => scanApi.status(scanId as string),
    enabled: !!scanId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status || ACTIVE_STATUSES.includes(status)) return POLL_INTERVAL_MS;
      return false;
    },
  });
}

export function isScanActive(status: ScanStatus | undefined): boolean {
  return !!status && ACTIVE_STATUSES.includes(status);
}
