import { getDb } from "./connection.js";
import type { Recommendation } from "../models/types.js";

interface RecommendationRow {
  id: string;
  scan_id: string;
  priority: string;
  problem: string;
  observation: string;
  recommendation: string;
  evidence_json: string;
}

function rowToRecommendation(row: RecommendationRow): Recommendation {
  return {
    id: row.id,
    priority: row.priority as Recommendation["priority"],
    problem: row.problem,
    observation: row.observation,
    recommendation: row.recommendation,
    evidenceResponseIds: JSON.parse(row.evidence_json) as string[],
  };
}

export function saveRecommendations(scanId: string, recommendations: Recommendation[]): void {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO recommendations (id, scan_id, priority, problem, observation, recommendation, evidence_json)
     VALUES (@id, @scanId, @priority, @problem, @observation, @recommendation, @evidenceJson)`,
  );
  const tx = db.transaction((items: Recommendation[]) => {
    for (const r of items) {
      stmt.run({
        id: r.id,
        scanId,
        priority: r.priority,
        problem: r.problem,
        observation: r.observation,
        recommendation: r.recommendation,
        evidenceJson: JSON.stringify(r.evidenceResponseIds),
      });
    }
  });
  tx(recommendations);
}

export function getRecommendationsForScan(scanId: string): Recommendation[] {
  const rows = getDb()
    .prepare(`SELECT * FROM recommendations WHERE scan_id = ?`)
    .all(scanId) as RecommendationRow[];
  return rows.map(rowToRecommendation);
}
