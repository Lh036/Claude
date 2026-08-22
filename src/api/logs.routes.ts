import { Router } from "express";
import { z } from "zod";
import { queryLogs } from "../services/logs/logService.js";
import { asyncHandler } from "./errorHandler.js";

export const logsRouter = Router();

const logsQuerySchema = z.object({
  scanId: z.string().min(1).optional(),
  level: z.enum(["DEBUG", "INFO", "SUCCESS", "WARNING", "ERROR"]).optional(),
  provider: z.string().min(1).optional(),
  event: z.string().min(1).optional(),
  q: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
  order: z.enum(["asc", "desc"]).optional(),
});

logsRouter.get(
  "/logs",
  asyncHandler(async (req, res) => {
    const query = logsQuerySchema.parse(req.query);
    const result = queryLogs(query);
    res.json(result);
  }),
);
