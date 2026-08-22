import { getDb } from "./connection.js";
import type { AIResponse, ProviderError, TokenUsage } from "../models/types.js";

interface ResponseRow {
  id: string;
  scan_id: string;
  question_id: string;
  provider: string;
  model: string;
  question: string;
  answer: string | null;
  timestamp: string;
  duration_ms: number;
  status: string;
  error_json: string | null;
  usage_json: string;
  attempt: number;
}

function rowToResponse(row: ResponseRow): AIResponse {
  return {
    id: row.id,
    scanId: row.scan_id,
    questionId: row.question_id,
    provider: row.provider as AIResponse["provider"],
    model: row.model,
    question: row.question,
    answer: row.answer,
    timestamp: row.timestamp,
    durationMs: row.duration_ms,
    status: row.status as AIResponse["status"],
    error: row.error_json ? (JSON.parse(row.error_json) as ProviderError) : null,
    usage: JSON.parse(row.usage_json) as TokenUsage,
    attempt: row.attempt,
  };
}

export function saveResponse(response: AIResponse): void {
  getDb()
    .prepare(
      `INSERT INTO responses (id, scan_id, question_id, provider, model, question, answer, timestamp, duration_ms, status, error_json, usage_json, attempt)
       VALUES (@id, @scanId, @questionId, @provider, @model, @question, @answer, @timestamp, @durationMs, @status, @errorJson, @usageJson, @attempt)`,
    )
    .run({
      id: response.id,
      scanId: response.scanId,
      questionId: response.questionId,
      provider: response.provider,
      model: response.model,
      question: response.question,
      answer: response.answer,
      timestamp: response.timestamp,
      durationMs: response.durationMs,
      status: response.status,
      errorJson: response.error ? JSON.stringify(response.error) : null,
      usageJson: JSON.stringify(response.usage),
      attempt: response.attempt,
    });
}

export function getResponsesForScan(scanId: string): AIResponse[] {
  const rows = getDb().prepare(`SELECT * FROM responses WHERE scan_id = ?`).all(scanId) as ResponseRow[];
  return rows.map(rowToResponse);
}

export function getResponse(id: string): AIResponse | null {
  const row = getDb().prepare(`SELECT * FROM responses WHERE id = ?`).get(id) as ResponseRow | undefined;
  return row ? rowToResponse(row) : null;
}
