import { listLogs, type LogFilter } from "../../db/log.repository.js";

export type { LogFilter };

/** Thin service wrapper so routes don't reach into db/ directly, matching the rest of the API layer's layering. */
export function queryLogs(filter: LogFilter) {
  return listLogs(filter);
}
