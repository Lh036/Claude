import { getDb } from "./connection.js";
import { generateId } from "../utils/id.js";
import type { Business, BusinessInput, BusinessResearch } from "../models/types.js";

interface BusinessRow {
  id: string;
  company_name: string;
  website: string | null;
  industry: string | null;
  location: string | null;
  description: string | null;
  extra_json: string;
  created_at: string;
  updated_at: string;
}

function rowToBusiness(row: BusinessRow): Business {
  return {
    id: row.id,
    companyName: row.company_name,
    website: row.website,
    industry: row.industry,
    location: row.location,
    description: row.description,
    extra: JSON.parse(row.extra_json) as Record<string, unknown>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createBusiness(input: BusinessInput): Business {
  const db = getDb();
  const now = new Date().toISOString();
  const business: Business = {
    id: generateId("biz"),
    companyName: input.companyName,
    website: input.website ?? null,
    industry: input.industry ?? null,
    location: input.location ?? null,
    description: input.description ?? null,
    extra: input.extra ?? {},
    createdAt: now,
    updatedAt: now,
  };
  db.prepare(
    `INSERT INTO businesses (id, company_name, website, industry, location, description, extra_json, created_at, updated_at)
     VALUES (@id, @companyName, @website, @industry, @location, @description, @extraJson, @createdAt, @updatedAt)`,
  ).run({
    id: business.id,
    companyName: business.companyName,
    website: business.website,
    industry: business.industry,
    location: business.location,
    description: business.description,
    extraJson: JSON.stringify(business.extra),
    createdAt: business.createdAt,
    updatedAt: business.updatedAt,
  });
  return business;
}

export function getBusiness(id: string): Business | null {
  const row = getDb().prepare(`SELECT * FROM businesses WHERE id = ?`).get(id) as BusinessRow | undefined;
  return row ? rowToBusiness(row) : null;
}

export function listBusinesses(): Business[] {
  const rows = getDb().prepare(`SELECT * FROM businesses ORDER BY created_at DESC`).all() as BusinessRow[];
  return rows.map(rowToBusiness);
}

export function updateBusiness(id: string, patch: Partial<BusinessInput>): Business | null {
  const existing = getBusiness(id);
  if (!existing) return null;
  const updated: Business = {
    ...existing,
    companyName: patch.companyName ?? existing.companyName,
    website: patch.website !== undefined ? patch.website : existing.website,
    industry: patch.industry !== undefined ? patch.industry : existing.industry,
    location: patch.location !== undefined ? patch.location : existing.location,
    description: patch.description !== undefined ? patch.description : existing.description,
    extra: patch.extra ? { ...existing.extra, ...patch.extra } : existing.extra,
    updatedAt: new Date().toISOString(),
  };
  getDb()
    .prepare(
      `UPDATE businesses SET company_name=@companyName, website=@website, industry=@industry, location=@location,
       description=@description, extra_json=@extraJson, updated_at=@updatedAt WHERE id=@id`,
    )
    .run({
      id: updated.id,
      companyName: updated.companyName,
      website: updated.website,
      industry: updated.industry,
      location: updated.location,
      description: updated.description,
      extraJson: JSON.stringify(updated.extra),
      updatedAt: updated.updatedAt,
    });
  return updated;
}

export function saveBusinessResearch(research: BusinessResearch): void {
  getDb()
    .prepare(
      `INSERT INTO business_research (business_id, data_json, researched_at)
       VALUES (@businessId, @dataJson, @researchedAt)
       ON CONFLICT(business_id) DO UPDATE SET data_json=excluded.data_json, researched_at=excluded.researched_at`,
    )
    .run({
      businessId: research.businessId,
      dataJson: JSON.stringify(research),
      researchedAt: research.researchedAt,
    });
}

export function getBusinessResearch(businessId: string): BusinessResearch | null {
  const row = getDb()
    .prepare(`SELECT data_json FROM business_research WHERE business_id = ?`)
    .get(businessId) as { data_json: string } | undefined;
  return row ? (JSON.parse(row.data_json) as BusinessResearch) : null;
}
