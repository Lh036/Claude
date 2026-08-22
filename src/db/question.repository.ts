import { getDb } from "./connection.js";
import type { GeneratedQuestion } from "../models/types.js";

interface QuestionRow {
  id: string;
  scan_id: string;
  question: string;
  category: string;
  intent: string;
  location: string | null;
  industry: string | null;
  priority: string;
  reason: string;
  valid: number;
  invalid_reason: string | null;
}

function rowToQuestion(row: QuestionRow): GeneratedQuestion {
  return {
    id: row.id,
    scanId: row.scan_id,
    question: row.question,
    category: row.category as GeneratedQuestion["category"],
    intent: row.intent as GeneratedQuestion["intent"],
    location: row.location,
    industry: row.industry,
    priority: row.priority as GeneratedQuestion["priority"],
    reason: row.reason,
    valid: row.valid === 1,
    invalidReason: row.invalid_reason ?? undefined,
  };
}

export function saveQuestions(questions: GeneratedQuestion[]): void {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO questions (id, scan_id, question, category, intent, location, industry, priority, reason, valid, invalid_reason)
     VALUES (@id, @scanId, @question, @category, @intent, @location, @industry, @priority, @reason, @valid, @invalidReason)`,
  );
  const insertAll = db.transaction((items: GeneratedQuestion[]) => {
    for (const q of items) {
      stmt.run({
        id: q.id,
        scanId: q.scanId,
        question: q.question,
        category: q.category,
        intent: q.intent,
        location: q.location,
        industry: q.industry,
        priority: q.priority,
        reason: q.reason,
        valid: q.valid ? 1 : 0,
        invalidReason: q.invalidReason ?? null,
      });
    }
  });
  insertAll(questions);
}

export function getQuestionsForScan(scanId: string): GeneratedQuestion[] {
  const rows = getDb().prepare(`SELECT * FROM questions WHERE scan_id = ?`).all(scanId) as QuestionRow[];
  return rows.map(rowToQuestion);
}

export function getQuestion(id: string): GeneratedQuestion | null {
  const row = getDb().prepare(`SELECT * FROM questions WHERE id = ?`).get(id) as QuestionRow | undefined;
  return row ? rowToQuestion(row) : null;
}
