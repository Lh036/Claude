import type {
  AIResponse,
  Business,
  BusinessInput,
  CompetitorAggregate,
  GeneratedQuestion,
  LogQueryResult,
  ProviderName,
  Recommendation,
  ResponseAnalysis,
  Scan,
  ScanResult,
  ScanStatistics,
  ScanStatus,
  ScanSummary,
} from "./types";

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    let code = "unknown_error";
    let message = `Request failed with status ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string; message?: string };
      code = body.error ?? code;
      message = body.message ?? message;
    } catch {
      // Response body wasn't JSON — keep the generic message.
    }
    throw new ApiError(res.status, code, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function qs(params: Record<string, string | number | undefined>): string {
  const usable = Object.entries(params).filter(([, v]) => v !== undefined && v !== "");
  if (usable.length === 0) return "";
  const search = new URLSearchParams(usable.map(([k, v]) => [k, String(v)]));
  return `?${search.toString()}`;
}

// --- Businesses -------------------------------------------------------------

export const businessApi = {
  list: () => request<Business[]>("/businesses"),
  get: (id: string) => request<Business>(`/businesses/${id}`),
  create: (input: BusinessInput) =>
    request<Business>("/businesses", { method: "POST", body: JSON.stringify(input) }),
  update: (id: string, patch: Partial<BusinessInput>) =>
    request<Business>(`/businesses/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  scans: (id: string) => request<Scan[]>(`/businesses/${id}/scans`),
};

// --- Scans --------------------------------------------------------------------

export interface CreateScanInput {
  businessId: string;
  questionCount?: number;
  providers?: ProviderName[];
}

export interface ListScansFilter {
  businessId?: string;
  status?: ScanStatus;
  limit?: number;
}

export const scanApi = {
  list: (filter: ListScansFilter = {}) =>
    request<ScanSummary[]>(`/scans${qs({ businessId: filter.businessId, status: filter.status, limit: filter.limit })}`),
  create: (input: CreateScanInput) => request<Scan>("/scans", { method: "POST", body: JSON.stringify(input) }),
  get: (id: string) => request<Scan>(`/scans/${id}`),
  status: (id: string) =>
    request<Pick<Scan, "id" | "status" | "stage" | "startedAt" | "completedAt" | "errors">>(`/scans/${id}/status`),
  questions: (id: string) => request<GeneratedQuestion[]>(`/scans/${id}/questions`),
  responses: (id: string) => request<AIResponse[]>(`/scans/${id}/responses`),
  analysis: (id: string) => request<ResponseAnalysis[]>(`/scans/${id}/analysis`),
  competitors: (id: string) => request<CompetitorAggregate[]>(`/scans/${id}/competitors`),
  recommendations: (id: string) => request<Recommendation[]>(`/scans/${id}/recommendations`),
  statistics: (id: string) => request<ScanStatistics | null>(`/scans/${id}/statistics`),
  result: (id: string) => request<ScanResult>(`/scans/${id}/result`),
};

// --- Logs -----------------------------------------------------------------

export interface LogFilter {
  scanId?: string;
  level?: string;
  provider?: string;
  event?: string;
  q?: string;
  limit?: number;
  offset?: number;
  order?: "asc" | "desc";
}

export const logApi = {
  query: (filter: LogFilter = {}) =>
    request<LogQueryResult>(
      `/logs${qs({
        scanId: filter.scanId,
        level: filter.level,
        provider: filter.provider,
        event: filter.event,
        q: filter.q,
        limit: filter.limit,
        offset: filter.offset,
        order: filter.order,
      })}`,
    ),
};
