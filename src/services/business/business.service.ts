import {
  createBusiness as createBusinessRow,
  getBusiness as getBusinessRow,
  listBusinesses as listBusinessRows,
  updateBusiness as updateBusinessRow,
} from "../../db/business.repository.js";
import type { Business, BusinessInput } from "../../models/types.js";
import { logger } from "../../logging/logger.js";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

function validateInput(input: BusinessInput): void {
  if (!input.companyName || input.companyName.trim().length < 2) {
    throw new ValidationError("companyName is required and must be at least 2 characters");
  }
  if (input.website) {
    try {
      // Accept bare domains too by prefixing a scheme for validation purposes only.
      const candidate = /^https?:\/\//i.test(input.website) ? input.website : `https://${input.website}`;
      new URL(candidate);
    } catch {
      throw new ValidationError(`website is not a valid URL: ${input.website}`);
    }
  }
}

export function createBusiness(input: BusinessInput): Business {
  validateInput(input);
  const business = createBusinessRow(input);
  logger.info("business_created", `Created business ${business.companyName}`, undefined, {
    businessId: business.id,
  });
  return business;
}

export function getBusiness(id: string): Business | null {
  return getBusinessRow(id);
}

export function listBusinesses(): Business[] {
  return listBusinessRows();
}

export function updateBusiness(id: string, patch: Partial<BusinessInput>): Business | null {
  if (patch.companyName !== undefined || patch.website !== undefined) {
    validateInput({
      companyName: patch.companyName ?? "placeholder-valid-name",
      website: patch.website ?? undefined,
    });
  }
  return updateBusinessRow(id, patch);
}
