import { Router } from "express";
import { z } from "zod";
import {
  createScan,
  getScan,
  getScanResult,
  getScanQuestions,
  getScanResponses,
  getScanAnalyses,
  getScanCompetitors,
  getScanRecommendations,
  getScanStatistics,
  listScans,
} from "../services/scan/scanService.js";
import { asyncHandler } from "./errorHandler.js";

const listScansQuerySchema = z.object({
  businessId: z.string().min(1).optional(),
  status: z.enum(["pending", "running", "completed", "failed", "partial"]).optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});

export const scanRouter = Router();

const createScanSchema = z.object({
  businessId: z.string().min(1),
  questionCount: z.number().int().positive().optional(),
  providers: z.array(z.enum(["openai", "gemini", "anthropic", "mock"])).optional(),
});

function notFound(res: import("express").Response, scanId: string): void {
  res.status(404).json({ error: "not_found", message: `Scan ${scanId} not found` });
}

scanRouter.post(
  "/scans",
  asyncHandler(async (req, res) => {
    const input = createScanSchema.parse(req.body);
    const scan = createScan(input);
    res.status(202).json(scan);
  }),
);

scanRouter.get(
  "/scans",
  asyncHandler(async (req, res) => {
    const query = listScansQuerySchema.parse(req.query);
    res.json(listScans(query));
  }),
);

scanRouter.get(
  "/scans/:id",
  asyncHandler(async (req, res) => {
    const scan = getScan(req.params.id as string);
    if (!scan) return notFound(res, req.params.id as string);
    res.json(scan);
  }),
);

scanRouter.get(
  "/scans/:id/status",
  asyncHandler(async (req, res) => {
    const scan = getScan(req.params.id as string);
    if (!scan) return notFound(res, req.params.id as string);
    res.json({ id: scan.id, status: scan.status, stage: scan.stage, startedAt: scan.startedAt, completedAt: scan.completedAt, errors: scan.errors });
  }),
);

scanRouter.get(
  "/scans/:id/questions",
  asyncHandler(async (req, res) => {
    const scan = getScan(req.params.id as string);
    if (!scan) return notFound(res, req.params.id as string);
    res.json(getScanQuestions(scan.id));
  }),
);

scanRouter.get(
  "/scans/:id/responses",
  asyncHandler(async (req, res) => {
    const scan = getScan(req.params.id as string);
    if (!scan) return notFound(res, req.params.id as string);
    res.json(getScanResponses(scan.id));
  }),
);

scanRouter.get(
  "/scans/:id/analysis",
  asyncHandler(async (req, res) => {
    const scan = getScan(req.params.id as string);
    if (!scan) return notFound(res, req.params.id as string);
    res.json(getScanAnalyses(scan.id));
  }),
);

scanRouter.get(
  "/scans/:id/competitors",
  asyncHandler(async (req, res) => {
    const scan = getScan(req.params.id as string);
    if (!scan) return notFound(res, req.params.id as string);
    res.json(getScanCompetitors(scan.id));
  }),
);

scanRouter.get(
  "/scans/:id/recommendations",
  asyncHandler(async (req, res) => {
    const scan = getScan(req.params.id as string);
    if (!scan) return notFound(res, req.params.id as string);
    res.json(getScanRecommendations(scan.id));
  }),
);

scanRouter.get(
  "/scans/:id/statistics",
  asyncHandler(async (req, res) => {
    const scan = getScan(req.params.id as string);
    if (!scan) return notFound(res, req.params.id as string);
    res.json(getScanStatistics(scan.id));
  }),
);

scanRouter.get(
  "/scans/:id/result",
  asyncHandler(async (req, res) => {
    const result = getScanResult(req.params.id as string);
    if (!result) return notFound(res, req.params.id as string);
    res.json(result);
  }),
);
