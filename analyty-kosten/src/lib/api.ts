import type { Category, CategoryInput, Expense, ExpenseFilter, ExpenseInput, Summary } from "@shared/types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  if (!res.ok) {
    let message = `Verzoek mislukt (${res.status})`;
    try {
      message = ((await res.json()) as { message?: string }).message ?? message;
    } catch {
      // geen JSON-body
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function filterQuery(filter: ExpenseFilter): string {
  const entries = Object.entries(filter).filter(([, v]) => v !== undefined && v !== "") as [string, string][];
  return entries.length ? `?${new URLSearchParams(entries).toString()}` : "";
}

export const api = {
  categories: () => request<Category[]>("/categories"),
  createCategory: (input: CategoryInput) => request<Category>("/categories", { method: "POST", body: JSON.stringify(input) }),
  updateCategory: (id: string, patch: Partial<CategoryInput>) =>
    request<Category>(`/categories/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteCategory: (id: string, reassignTo: string | null) =>
    request<void>(`/categories/${id}${reassignTo ? `?reassignTo=${encodeURIComponent(reassignTo)}` : ""}`, { method: "DELETE" }),

  expenses: (filter: ExpenseFilter = {}) => request<Expense[]>(`/expenses${filterQuery(filter)}`),
  createExpense: (input: ExpenseInput) => request<Expense>("/expenses", { method: "POST", body: JSON.stringify(input) }),
  updateExpense: (id: string, patch: Partial<ExpenseInput>) =>
    request<Expense>(`/expenses/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteExpense: (id: string) => request<void>(`/expenses/${id}`, { method: "DELETE" }),
  bookNext: (id: string) => request<Expense>(`/expenses/${id}/book-next`, { method: "POST" }),
  exportUrl: (filter: ExpenseFilter = {}) => `/api/expenses/export.csv${filterQuery(filter)}`,

  summary: (year: number) => request<Summary>(`/summary?year=${year}`),
};
