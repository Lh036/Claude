/**
 * Generates surface-form variants of a company name / website, used both to seed
 * business research and to drive robust mention detection later in the pipeline.
 */

const LEGAL_SUFFIXES = [
  "b\\.?v\\.?",
  "n\\.?v\\.?",
  "gmbh",
  "ag",
  "inc\\.?",
  "incorporated",
  "llc",
  "ltd\\.?",
  "limited",
  "corp\\.?",
  "corporation",
  "co\\.?",
  "company",
  "plc",
  "s\\.?a\\.?",
  "s\\.?r\\.?l\\.?",
  "vof",
  "eenmanszaak",
];

const LEGAL_SUFFIX_RE = new RegExp(`\\s+(${LEGAL_SUFFIXES.join("|")})\\.?$`, "i");

function stripLegalSuffix(name: string): string {
  return name.replace(LEGAL_SUFFIX_RE, "").trim();
}

function acronym(name: string): string | null {
  const words = name
    .split(/\s+/)
    .filter((w) => /[a-zA-Z]/.test(w))
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""));
  if (words.length < 2) return null;
  const letters = words.map((w) => w[0]).join("");
  return letters.length >= 2 ? letters.toUpperCase() : null;
}

export function domainFromWebsite(website: string | null | undefined): string | null {
  if (!website) return null;
  try {
    const withScheme = /^https?:\/\//i.test(website) ? website : `https://${website}`;
    const host = new URL(withScheme).hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return null;
  }
}

export function generateNameVariants(companyName: string, website?: string | null): string[] {
  const variants = new Set<string>();
  const trimmed = companyName.trim();
  variants.add(trimmed);
  variants.add(trimmed.toLowerCase());

  const stripped = stripLegalSuffix(trimmed);
  if (stripped && stripped !== trimmed) {
    variants.add(stripped);
    variants.add(stripped.toLowerCase());
  }

  const noSpaces = stripped.replace(/\s+/g, "");
  if (noSpaces.length > 2) variants.add(noSpaces);

  const ac = acronym(stripped);
  if (ac) variants.add(ac);

  const domain = domainFromWebsite(website);
  if (domain) {
    variants.add(domain);
    const domainBase = domain.split(".")[0];
    if (domainBase && domainBase.length > 2) variants.add(domainBase);
  }

  // Ampersand / "and" normalization ("H&M" <-> "H and M").
  if (stripped.includes("&")) {
    variants.add(stripped.replace(/&/g, "and"));
  } else if (/\band\b/i.test(stripped)) {
    variants.add(stripped.replace(/\band\b/gi, "&"));
  }

  return Array.from(variants).filter((v) => v.trim().length > 0);
}
