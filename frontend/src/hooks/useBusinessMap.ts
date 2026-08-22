import { useQuery } from "@tanstack/react-query";
import { businessApi } from "@/lib/api";
import type { Business } from "@/lib/types";

/** Fetches all businesses once and exposes them as an id -> Business lookup, for joining onto scan/log rows that only carry a businessId. */
export function useBusinessMap() {
  const query = useQuery({ queryKey: ["businesses"], queryFn: businessApi.list });
  const map: Record<string, Business> = {};
  for (const b of query.data ?? []) map[b.id] = b;
  return { ...query, map };
}
