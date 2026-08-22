import express, { type Express } from "express";
import cors from "cors";
import { businessRouter } from "./business.routes.js";
import { scanRouter } from "./scan.routes.js";
import { logsRouter } from "./logs.routes.js";
import { errorHandler } from "./errorHandler.js";

export function createApp(): Express {
  const app = express();
  // The frontend is a separate app (its own dev server / static host), so the API
  // needs to be reachable cross-origin. No cookies/credentials are used, so an
  // open CORS policy here doesn't expose anything sensitive.
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api", businessRouter);
  app.use("/api", scanRouter);
  app.use("/api", logsRouter);

  app.use(errorHandler);
  return app;
}
