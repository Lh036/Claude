import { getDb } from "./connection.js";
import type { LogEntry } from "../logging/logger.js";

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
  const rows = getDb().prepare(`SELECT * FROM logs WHERE scan_id = ? ORDER BY id ASC`).all(scanId) as Array<{
    timestamp: string;
    level: LogEntry["level"];
    event: string;
    scan_id: string | null;
    question_id: string | null;
    provider: string | null;
    message: string;
    metadata_json: string | null;
  }>;
  return rows.map((row) => ({
    timestamp: row.timestamp,
    level: row.level,
    event: row.event,
    scanId: row.scan_id ?? undefined,
    questionId: row.question_id ?? undefined,
    provider: row.provider ?? undefined,
    message: row.message,
    metadata: row.metadata_json ? (JSON.parse(row.metadata_json) as Record<string, unknown>) : undefined,
  }));
}
