import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "../config/index.js";

let instance: Database.Database | undefined;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  website TEXT,
  industry TEXT,
  location TEXT,
  description TEXT,
  extra_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS business_research (
  business_id TEXT PRIMARY KEY REFERENCES businesses(id),
  data_json TEXT NOT NULL,
  researched_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scans (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  status TEXT NOT NULL,
  stage TEXT NOT NULL,
  options_json TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  errors_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scans_business ON scans(business_id);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  scan_id TEXT NOT NULL REFERENCES scans(id),
  question TEXT NOT NULL,
  category TEXT NOT NULL,
  intent TEXT NOT NULL,
  location TEXT,
  industry TEXT,
  priority TEXT NOT NULL,
  reason TEXT NOT NULL,
  valid INTEGER NOT NULL,
  invalid_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_questions_scan ON questions(scan_id);

CREATE TABLE IF NOT EXISTS responses (
  id TEXT PRIMARY KEY,
  scan_id TEXT NOT NULL REFERENCES scans(id),
  question_id TEXT NOT NULL REFERENCES questions(id),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT,
  timestamp TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  status TEXT NOT NULL,
  error_json TEXT,
  usage_json TEXT NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_responses_scan ON responses(scan_id);
CREATE INDEX IF NOT EXISTS idx_responses_question ON responses(question_id);

CREATE TABLE IF NOT EXISTS response_analyses (
  id TEXT PRIMARY KEY,
  scan_id TEXT NOT NULL REFERENCES scans(id),
  response_id TEXT NOT NULL REFERENCES responses(id),
  question_id TEXT NOT NULL REFERENCES questions(id),
  provider TEXT NOT NULL,
  mention_json TEXT NOT NULL,
  position_json TEXT NOT NULL,
  context_json TEXT NOT NULL,
  competitors_json TEXT NOT NULL,
  analyzed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_analyses_scan ON response_analyses(scan_id);

CREATE TABLE IF NOT EXISTS competitors (
  scan_id TEXT NOT NULL REFERENCES scans(id),
  name TEXT NOT NULL,
  data_json TEXT NOT NULL,
  PRIMARY KEY (scan_id, name)
);

CREATE TABLE IF NOT EXISTS recommendations (
  id TEXT PRIMARY KEY,
  scan_id TEXT NOT NULL REFERENCES scans(id),
  priority TEXT NOT NULL,
  problem TEXT NOT NULL,
  observation TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  evidence_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_recommendations_scan ON recommendations(scan_id);

CREATE TABLE IF NOT EXISTS scan_results (
  scan_id TEXT PRIMARY KEY REFERENCES scans(id),
  cross_model_json TEXT,
  geo_score_json TEXT,
  statistics_json TEXT
);

CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  level TEXT NOT NULL,
  event TEXT NOT NULL,
  scan_id TEXT,
  question_id TEXT,
  provider TEXT,
  message TEXT NOT NULL,
  metadata_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_logs_scan ON logs(scan_id);
`;

export function getDb(): Database.Database {
  if (instance) return instance;
  const path = config().dbPath;
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }
  instance = new Database(path);
  if (path !== ":memory:") {
    instance.pragma("journal_mode = WAL");
  }
  instance.pragma("foreign_keys = ON");
  instance.exec(SCHEMA);
  return instance;
}

/** Test helper: close and drop the cached connection so a fresh :memory: db can be created. */
export function resetDb(): void {
  if (instance) {
    instance.close();
    instance = undefined;
  }
}
