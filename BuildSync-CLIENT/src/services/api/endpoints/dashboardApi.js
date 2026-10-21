import { baseApi, TAGS } from "../baseApi";

/**
 * Admin operational summary.
 *
 * Counts are computed by the server from the same collections the lists read,
 * so the tiles cannot drift from the underlying data.
 */
export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDashboardSummary: builder.query({
      query: () => ({ url: "/dashboard/summary", method: "GET" }),
      transformResponse: (res) =>
        res?.success ? res : null,
      // Approvals made by another admin should move these numbers on their own.
      pollingInterval: 30_000,
      providesTags: [TAGS.Dashboard],
    }),
  }),
});

export const { useGetDashboardSummaryQuery } = dashboardApi;