/**
 * Mutation wiring shared by the action components.
 *
 * Each successful server-confirmed change invalidates only the cache keys that
 * actually depend on it, so dependent lists and dashboard counts update
 * without a manual refresh and without re-fetching unrelated endpoints.
 */
import { useMutation } from "./useQuery";

/** Leave decisions affect the admin queue, the employee's own history and counts. */
export const LEAVE_KEYS = ["leaves", "employee-dashboard", "dashboard-summary"];

/** A work-request decision affects both the admin queue and the client view. */
export const WORK_REQUEST_KEYS = ["work-requests", "client-dashboard", "dashboard-summary"];

/** Workforce mutations affect lists, site pickers and dashboard counts. */
export const EMPLOYEE_KEYS = ["employees", "departments", "dashboard-summary"];

export const CLIENT_KEYS = ["clients", "dashboard-summary"];

export const DEPARTMENT_KEYS = ["departments", "employees", "salary", "dashboard-summary"];

export const ATTENDANCE_KEYS = ["attendance", "dashboard-summary"];

export const SALARY_KEYS = ["salary", "dashboard-summary"];

/** Thrown away by callers that only need the cache wiring. */
export const useInvalidatingMutation = (fn, keys) => useMutation(fn, { invalidate: keys });

export { useMutation };