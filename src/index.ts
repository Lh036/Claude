import { createApp } from "./api/app.js";
import { config } from "./config/index.js";
import { getDb } from "./db/connection.js";
import { logger, CompositeDbSink, ConsoleSink } from "./logging/logger.js";
import { insertLog } from "./db/log.repository.js";

getDb(); // Ensures schema exists before the server starts accepting requests.
logger.setSink(new CompositeDbSink(new ConsoleSink(), insertLog));

const app = createApp();
const cfg = config();

app.listen(cfg.port, () => {
  logger.info("server_started", `GEO system listening on port ${cfg.port} (mode=${cfg.mode})`);
});
