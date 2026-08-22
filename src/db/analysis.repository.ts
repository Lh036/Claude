import { getDb } from "./connection.js";
import type {
  ResponseAnalysis,
  MentionResult,
  PositionResult,
  ContextAnalysisResult,
  DetectedCompetitorMention,
  CompetitorAggregate,
} from "../models/types.js";

interface AnalysisRow {
  id: string;
  scan_id: string;
  response_id: string;
  question_id: string;
  provider: string;
  mention_json: string;
  position_json: string;
  context_json: string;
  competitors_json: string;
  analyzed_at: string;
}

function rowToAnalysis(row: AnalysisRow): ResponseAnalysis {
  return {
    id: row.id,
    scanId: row.scan_id,
    responseId: row.response_id,
    questionId: row.question_id,
    provider: row.provider as ResponseAnalysis["provider"],
    mention: JSON.parse(row.mention_json) as MentionResult,
    position: JSON.parse(row.position_json) as PositionResult,
    context: JSON.parse(row.context_json) as ContextAnalysisResult,
    competitorsDetected: JSON.parse(row.competitors_json) as DetectedCompetitorMention[],
    analyzedAt: row.analyzed_at,
  };
}

export function saveAnalysis(analysis: ResponseAnalysis): void {
  getDb()
    .prepare(
      `INSERT INTO response_analyses (id, scan_id, response_id, question_id, provider, mention_json, position_json, context_json, competitors_json, analyzed_at)
       VALUES (@id, @scanId, @responseId, @questionId, @provider, @mentionJson, @positionJson, @contextJson, @competitorsJson, @analyzedAt)`,
    )
    .run({
      id: analysis.id,
      scanId: analysis.scanId,
      responseId: analysis.responseId,
      questionId: analysis.questionId,
      provider: analysis.provider,
      mentionJson: JSON.stringify(analysis.mention),
      positionJson: JSON.stringify(analysis.position),
      contextJson: JSON.stringify(analysis.context),
      competitorsJson: JSON.stringify(analysis.competitorsDetected),
      analyzedAt: analysis.analyzedAt,
    });
}

export function getAnalysesForScan(scanId: string): ResponseAnalysis[] {
  const rows = getDb().prepare(`SELECT * FROM response_analyses WHERE scan_id = ?`).all(scanId) as AnalysisRow[];
  return rows.map(rowToAnalysis);
}

export function saveCompetitors(scanId: string, competitors: CompetitorAggregate[]): void {
  const db = getDb();
  const del = db.prepare(`DELETE FROM competitors WHERE scan_id = ?`);
  const ins = db.prepare(`INSERT INTO competitors (scan_id, name, data_json) VALUES (@scanId, @name, @dataJson)`);
  const tx = db.transaction((items: CompetitorAggregate[]) => {
    del.run(scanId);
    for (const c of items) {
      ins.run({ scanId, name: c.name, dataJson: JSON.stringify(c) });
    }
  });
  tx(competitors);
}

export function getCompetitorsForScan(scanId: string): CompetitorAggregate[] {
  const rows = getDb().prepare(`SELECT data_json FROM competitors WHERE scan_id = ?`).all(scanId) as {
    data_json: string;
  }[];
  return rows.map((r) => JSON.parse(r.data_json) as CompetitorAggregate);
}
