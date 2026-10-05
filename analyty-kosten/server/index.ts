import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { openDb } from "./db";
import { createApp } from "./app";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT ?? 3100);
const dbPath = process.env.KOSTEN_DB_PATH ?? join(root, "data", "kosten.sqlite");

const db = openDb(dbPath);
const app = createApp(db, { staticDir: process.env.NODE_ENV === "production" ? join(root, "dist") : undefined });

app.listen(port, () => {
  console.log(`Analyty kosten-API draait op http://localhost:${port} (database: ${dbPath})`);
});
