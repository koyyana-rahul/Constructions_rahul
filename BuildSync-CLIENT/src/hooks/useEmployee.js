import { useQuery } from "./useQuery";
import { api } from "../lib/api";

/**
 * Employee identity for the admin employee-scoped pages.
 *
 * Uses the `["employee", id]` cache key so the page header and the breadcrumb
 * that sits above it read from a single request. The key includes the id, so
 * navigating from one employee to another switches the cache entry and the
 * previous employee is never rendered while the new one loads.
 */
export const useEmployee = (id, options = {}) =>
  useQuery(
    ["employee", id],
    async () => {
      const { data: res } = await api.get(`/employee/${id}`);
      if (!res.success || !res.employee) throw new Error("Employee record not found.");
      return res.employee;
    },
    { staleTime: 60_000, enabled: Boolean(id), ...options }
  );

export default useEmployee;