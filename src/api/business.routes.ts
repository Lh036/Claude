import { Router } from "express";
import { z } from "zod";
import { createBusiness, getBusiness, listBusinesses, updateBusiness } from "../services/business/business.service.js";
import { listScansForBusiness } from "../services/scan/scanService.js";
import { asyncHandler } from "./errorHandler.js";

export const businessRouter = Router();

const businessInputSchema = z.object({
  companyName: z.string().min(2),
  website: z.string().min(1).nullable().optional(),
  industry: z.string().min(1).nullable().optional(),
  location: z.string().min(1).nullable().optional(),
  description: z.string().min(1).nullable().optional(),
  extra: z.record(z.string(), z.unknown()).optional(),
});

businessRouter.post(
  "/businesses",
  asyncHandler(async (req, res) => {
    const input = businessInputSchema.parse(req.body);
    const business = createBusiness(input);
    res.status(201).json(business);
  }),
);

businessRouter.get(
  "/businesses",
  asyncHandler(async (_req, res) => {
    res.json(listBusinesses());
  }),
);

businessRouter.get(
  "/businesses/:id",
  asyncHandler(async (req, res) => {
    const business = getBusiness(req.params.id as string);
    if (!business) {
      res.status(404).json({ error: "not_found", message: `Business ${req.params.id} not found` });
      return;
    }
    res.json(business);
  }),
);

businessRouter.patch(
  "/businesses/:id",
  asyncHandler(async (req, res) => {
    const patch = businessInputSchema.partial().parse(req.body);
    const updated = updateBusiness(req.params.id as string, patch);
    if (!updated) {
      res.status(404).json({ error: "not_found", message: `Business ${req.params.id} not found` });
      return;
    }
    res.json(updated);
  }),
);

businessRouter.get(
  "/businesses/:id/scans",
  asyncHandler(async (req, res) => {
    const business = getBusiness(req.params.id as string);
    if (!business) {
      res.status(404).json({ error: "not_found", message: `Business ${req.params.id} not found` });
      return;
    }
    res.json(listScansForBusiness(business.id));
  }),
);
