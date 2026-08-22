process.env.GEO_ENV = "test";
process.env.GEO_DB_PATH = ":memory:";
process.env.GEO_LOG_LEVEL = "ERROR";
process.env.GEO_DEFAULT_QUESTION_COUNT = "14";

import { beforeEach } from "vitest";
import { resetConfigCache } from "../src/config/index.js";
import { resetDb, getDb } from "../src/db/connection.js";

beforeEach(() => {
  resetConfigCache();
  resetDb();
  getDb();
});
