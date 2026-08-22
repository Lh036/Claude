import { getDb } from "./connection.js";
import { generateId } from "../utils/id.js";
import type {
  Scan,
  ScanOptions,
  ScanStatus,
  ScanStage,
  ScanError,
  CrossModelAnalysis,
  GeoScore,
  ScanStatistics,
} from "../models/types.js";

interface ScanRow {
  id: string;
  business_id: string;
  status: ScanStatus;
  stage: ScanStage;
  options_json: string;
  started_at: string | null;
  completed_at: string | null;
  errors_json: string;
  created_at: string;
  updated_at: string;
}

function rowToScan(row: ScanRow): Scan {
  return {
    id: row.id,
    businessId: row.business_id,
    status: row.status,
    stage: row.stage,
    options: JSON.parse(row.options_json) as ScanOptions,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    errors: JSON.parse(row.errors_json) as ScanError[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createScan(businessId: string, options: ScanOptions): Scan {
  const db = getDb();
  const now = new Date().toISOString();
  const scan: Scan = {
    id: generateId("scan"),
    businessId,
    status: "pending",
    stage: "created",
    options,
    startedAt: null,
    completedAt: null,
    errors: [],
    createdAt: now,
    updatedAt: now,
  };
  db.prepare(
    `INSERT INTO scans (id, business_id, status, stage, options_json, started_at, completed_at, errors_json, created_at, updated_at)
     VALUES (@id, @businessId, @status, @stage, @optionsJson, @startedAt, @completedAt, @errorsJson, @createdAt, @updatedAt)`,
  ).run({
    id: scan.id,
    businessId: scan.businessId,
    status: scan.status,
    stage: scan.stage,
    optionsJson: JSON.stringify(scan.options),
    startedAt: scan.startedAt,
    completedAt: scan.completedAt,
    errorsJson: JSON.stringify(scan.errors),
    createdAt: scan.createdAt,
    updatedAt: scan.updatedAt,
  });
  return scan;
}

export function getScan(id: string): Scan | null {
  const row = getDb().prepare(`SELECT * FROM scans WHERE id = ?`).get(id) as ScanRow | undefined;
  return row ? rowToScan(row) : null;
}

export function listScansForBusiness(businessId: string): Scan[] {
  const rows = getDb()
    .prepare(`SELECT * FROM scans WHERE business_id = ? ORDER BY created_at DESC`)
    .all(businessId) as ScanRow[];
  return rows.map(rowToScan);
}

export function updateScan(
  id: string,
  patch: Partial<Pick<Scan, "status" | "stage" | "startedAt" | "completedAt" | "errors">>,
): Scan | null {
  const existing = getScan(id);
  if (!existing) return null;
  const updated: Scan = {
    ...existing,
    status: patch.status ?? existing.status,
    stage: patch.stage ?? existing.stage,
    startedAt: patch.startedAt !== undefined ? patch.startedAt : existing.startedAt,
    completedAt: patch.completedAt !== undefined ? patch.completedAt : existing.completedAt,
    errors: patch.errors ?? existing.errors,
    updatedAt: new Date().toISOString(),
  };
  getDb()
    .prepare(
      `UPDATE scans SET status=@status, stage=@stage, started_at=@startedAt, completed_at=@completedAt,
       errors_json=@errorsJson, updated_at=@updatedAt WHERE id=@id`,
    )
    .run({
      id: updated.id,
      status: updated.status,
      stage: updated.stage,
      startedAt: updated.startedAt,
      completedAt: updated.completedAt,
      errorsJson: JSON.stringify(updated.errors),
      updatedAt: updated.updatedAt,
    });
  return updated;
}

export function appendScanError(id: string, error: ScanError): Scan | null {
  const existing = getScan(id);
  if (!existing) return null;
  return updateScan(id, { errors: [...existing.errors, error] });
}

export function saveScanResults(
  scanId: string,
  data: { crossModel: CrossModelAnalysis | null; geoScore: GeoScore | null; statistics: ScanStatistics | null },
): void {
  getDb()
    .prepare(
      `INSERT INTO scan_results (scan_id, cross_model_json, geo_score_json, statistics_json)
       VALUES (@scanId, @crossModelJson, @geoScoreJson, @statisticsJson)
       ON CONFLICT(scan_id) DO UPDATE SET cross_model_json=excluded.cross_model_json,
         geo_score_json=excluded.geo_score_json, statistics_json=excluded.statistics_json`,
    )
    .run({
      scanId,
      crossModelJson: data.crossModel ? JSON.stringify(data.crossModel) : null,
      geoScoreJson: data.geoScore ? JSON.stringify(data.geoScore) : null,
      statisticsJson: data.statistics ? JSON.stringify(data.statistics) : null,
    });
}

export function getScanResults(scanId: string): {
  crossModel: CrossModelAnalysis | null;
  geoScore: GeoScore | null;
  statistics: ScanStatistics | null;
} {
  const row = getDb().prepare(`SELECT * FROM scan_results WHERE scan_id = ?`).get(scanId) as
    | { cross_model_json: string | null; geo_score_json: string | null; statistics_json: string | null }
    | undefined;
  if (!row) return { crossModel: null, geoScore: null, statistics: null };
  return {
    crossModel: row.cross_model_json ? (JSON.parse(row.cross_model_json) as CrossModelAnalysis) : null,
    geoScore: row.geo_score_json ? (JSON.parse(row.geo_score_json) as GeoScore) : null,
    statistics: row.statistics_json ? (JSON.parse(row.statistics_json) as ScanStatistics) : null,
  };
}
