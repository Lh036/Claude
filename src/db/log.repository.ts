import { getDb } from "./connection.js";
import type { LogEntry, LogLevel } from "../logging/logger.js";

interface LogRow {
  id: number;
  timestamp: string;
  level: LogLevel;
  event: string;
  scan_id: string | null;
  question_id: string | null;
  provider: string | null;
  message: string;
  metadata_json: string | null;
}

function rowToEntry(row: LogRow): LogEntry {
  return {
    id: row.id,
    timestamp: row.timestamp,
    level: row.level,
    event: row.event,
    scanId: row.scan_id ?? undefined,
    questionId: row.question_id ?? undefined,
    provider: row.provider ?? undefined,
    message: row.message,
    metadata: row.metadata_json ? (JSON.parse(row.metadata_json) as Record<string, unknown>) : undefined,
  };
}

export function insertLog(entry: LogEntry): void {
  getDb()
    .prepare(
      `INSERT INTO logs (timestamp, level, event, scan_id, question_id, provider, message, metadata_json)
       VALUES (@timestamp, @level, @event, @scanId, @questionId, @provider, @message, @metadataJson)`,
    )
    .run({
      timestamp: entry.timestamp,
      level: entry.level,
      event: entry.event,
      scanId: entry.scanId ?? null,
      questionId: entry.questionId ?? null,
      provider: entry.provider ?? null,
      message: entry.message,
      metadataJson: entry.metadata ? JSON.stringify(entry.metadata) : null,
    });
}

export function getLogsForScan(scanId: string): LogEntry[] {
  const rows = getDb().prepare(`SELECT * FROM logs WHERE scan_id = ? ORDER BY id ASC`).all(scanId) as LogRow[];
  return rows.map(rowToEntry);
}

export interface LogFilter {
  scanId?: string;
  level?: LogLevel;
  provider?: string;
  event?: string;
  /** Case-insensitive substring search across message + event. */
  q?: string;
  limit?: number;
  offset?: number;
  /** Sort by timestamp/id. Defaults to "desc" (newest first) — the natural order for a log viewer. */
  order?: "asc" | "desc";
}

/**
 * Queryable log listing backing the frontend's Logs/Errors/Activity views and the
 * per-run timeline. All filtering happens in SQL; nothing here changes what gets
 * logged, it only reads the existing `logs` table (populated by logger.ts).
 */
export function listLogs(filter: LogFilter = {}): { entries: LogEntry[]; total: number } {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};

  if (filter.scanId) {
    clauses.push("scan_id = @scanId");
    params.scanId = filter.scanId;
  }
  if (filter.level) {
    clauses.push("level = @level");
    params.level = filter.level;
  }
  if (filter.provider) {
    clauses.push("provider = @provider");
    params.provider = filter.provider;
  }
  if (filter.event) {
    clauses.push("event = @event");
    params.event = filter.event;
  }
  if (filter.q) {
    clauses.push("(message LIKE @q OR event LIKE @q)");
    params.q = `%${filter.q}%`;
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const order = filter.order === "asc" ? "ASC" : "DESC";
  const limit = filter.limit && filter.limit > 0 ? Math.min(filter.limit, 500) : 100;
  const offset = filter.offset && filter.offset > 0 ? filter.offset : 0;

  const db = getDb();
  const total = (db.prepare(`SELECT COUNT(*) AS count FROM logs ${where}`).get(params) as { count: number }).count;
  const rows = db
    .prepare(`SELECT * FROM logs ${where} ORDER BY id ${order} LIMIT ${limit} OFFSET ${offset}`)
    .all(params) as LogRow[];

  return { entries: rows.map(rowToEntry), total };
}
