import { createApi } from "@reduxjs/toolkit/query/react";
import { api as axiosClient } from "../../lib/api";

/**
 * Cache tags.
 *
 * Naming rule: the plural tag invalidates the whole collection, the singular
 * tag invalidates one record. Every mutation declares the tags it actually
 * affects so a leave approval refreshes the admin queue, the employee's own
 * history and the dashboard counts - and nothing else.
 */
export const TAGS = {
  Auth: "Auth",
  Dashboard: "Dashboard",
  Employees: "Employees",
  Employee: "Employee",
  Departments: "Departments",
  Department: "Department",
  Clients: "Clients",
  Client: "Client",
  Leaves: "Leaves",
  Leave: "Leave",
  Attendance: "Attendance",
  AttendanceReport: "AttendanceReport",
  Salary: "Salary",
  WorkRequests: "WorkRequests",
  WorkRequest: "WorkRequest",
};

/**
 * Axios-backed base query.
 *
 * RTK Query ships with `fetchBaseQuery`, but this application already has an
 * Axios instance that owns three behaviours we must not lose:
 *   1. the configured base URL (VITE_API_URL),
 *   2. the `Authorization: Bearer` header attached per request,
 *   3. the 401 interceptor that clears the token and announces session expiry.
 *
 * Reusing the same instance means there is exactly ONE HTTP client with ONE
 * authentication policy. A second, `fetch`-based client would have been a
 * competing implementation of the same concern.
 *
 * Errors are reshaped into RTK Query's `{ error: { status, data } }` contract
 * so `getErrorMessage` / `isPermissionError` work identically on either side.
 */
const axiosBaseQuery = () => async (args) => {
  const { url, method = "GET", params, body, headers } = args;

  try {
    const result = await axiosClient.request({
      url,
      method,
      params,
      data: body,
      headers,
      // Uploads are multipart; Axios must set the boundary itself.
      ...(body instanceof FormData
        ? { headers: { "Content-Type": undefined } }
        : {}),
    });
    return { data: result.data };
  } catch (axiosError) {
    const status = axiosError.response?.status;
    // No response at all -> the request never reached the server.
    if (!status) {
      return { error: { status: "FETCH_ERROR", data: axiosError } };
    }
    return { error: { status, data: axiosError.response.data } };
  }
};

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: axiosBaseQuery(),
  tagTypes: Object.values(TAGS),
  // Anything unreachable is stale after 60s, so a re-visit shows real data.
  keepUnusedDataFor: 60,
  refetchOnMountOrArgChange: 30,
  refetchOnReconnect: true,
  refetchOnFocus: true,
  endpoints: () => ({}),
});
