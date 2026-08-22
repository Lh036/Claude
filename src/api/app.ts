import express, { type Express } from "express";
import { businessRouter } from "./business.routes.js";
import { scanRouter } from "./scan.routes.js";
import { errorHandler } from "./errorHandler.js";

export function createApp(): Express {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api", businessRouter);
  app.use("/api", scanRouter);

  app.use(errorHandler);
  return app;
}
