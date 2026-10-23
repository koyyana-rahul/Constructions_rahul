import { baseApi, TAGS } from "../baseApi";

/**
 * Platform services: notifications, company settings, reports, search, the
 * immutable audit trail and the database-grounded operations assistant.
 */
export const platformApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /* ------------------------------------------------------ notifications */
    getNotifications: builder.query({
      query: (params = {}) => ({ url: "/notification", method: "GET", params }),
      transformResponse: (res) => ({
        notifications: res?.notifications ?? [],
        unread: res?.unread ?? 0,
        pagination: res?.pagination ?? null,
      }),
      pollingInterval: 30_000,
      providesTags: [TAGS.Notifications],
    }),

    getUnreadCount: builder.query({
      query: () => ({ url: "/notification/unread-count", method: "GET" }),
      transformResponse: (res) => res?.unread ?? 0,
      pollingInterval: 30_000,
      providesTags: [TAGS.Notifications],
    }),

    markNotificationRead: builder.mutation({
      query: (id) => ({ url: `/notification/${id}/read`, method: "POST" }),
      invalidatesTags: [TAGS.Notifications],
    }),

    markAllNotificationsRead: builder.mutation({
      query: () => ({ url: "/notification/read-all", method: "POST" }),
      invalidatesTags: [TAGS.Notifications],
    }),

    deleteNotification: builder.mutation({
      query: (id) => ({ url: `/notification/${id}`, method: "DELETE" }),
      invalidatesTags: [TAGS.Notifications],
    }),

    /* ------------------------------------------------------ organization */
    getOrganization: builder.query({
      query: () => ({ url: "/organization", method: "GET" }),
      transformResponse: (res) => res?.organization ?? null,
      providesTags: [TAGS.Organization],
    }),

    updateOrganization: builder.mutation({
      query: (body) => ({ url: "/organization", method: "PUT", body }),
      invalidatesTags: [TAGS.Organization, TAGS.Invoices],
    }),

    getNextNumbers: builder.query({
      query: () => ({ url: "/organization/next-numbers", method: "GET" }),
      transformResponse: (res) => res?.next ?? null,
      providesTags: [TAGS.Organization],
    }),

    /* ---------------------------------------------------------- reports */
    getReportOverview: builder.query({
      query: () => ({ url: "/report/overview", method: "GET" }),
      transformResponse: (res) => ({
        role: res?.role ?? null,
        overview: res?.overview ?? null,
      }),
      providesTags: [TAGS.Reports, TAGS.Dashboard],
    }),

    getReportIndex: builder.query({
      query: () => ({ url: "/report/index", method: "GET" }),
      transformResponse: (res) => ({
        overview: res?.overview ?? null,
        counts: res?.counts ?? null,
      }),
      providesTags: [TAGS.Reports, TAGS.Dashboard],
    }),

    getProjectReport: builder.query({
      query: (params = {}) => ({ url: "/report/project", method: "GET", params }),
      transformResponse: (res) => res?.projects ?? [],
      providesTags: [TAGS.Reports],
    }),

    getFinanceReport: builder.query({
      query: (params = {}) => ({ url: "/report/finance", method: "GET", params }),
      transformResponse: (res) => ({
        range: res?.range ?? null,
        summary: res?.summary ?? null,
        trends: res?.trends ?? [],
        costByCategory: res?.costByCategory ?? [],
        receivablesAging: res?.receivablesAging ?? [],
        topClients: res?.topClients ?? [],
      }),
      providesTags: [TAGS.Reports],
    }),

    getInventoryReport: builder.query({
      query: (params = {}) => ({ url: "/report/inventory", method: "GET", params }),
      transformResponse: (res) => ({
        summary: res?.summary ?? null,
        rows: res?.rows ?? [],
      }),
      providesTags: [TAGS.Reports],
    }),

    getSafetyReport: builder.query({
      query: (params = {}) => ({ url: "/report/safety", method: "GET", params }),
      transformResponse: (res) => ({
        range: res?.range ?? null,
        summary: res?.summary ?? null,
        trends: res?.trends ?? [],
      }),
      providesTags: [TAGS.Reports],
    }),

    getFieldReport: builder.query({
      query: (params = {}) => ({ url: "/report/field", method: "GET", params }),
      transformResponse: (res) => ({
        range: res?.range ?? null,
        projects: res?.projects ?? [],
      }),
      providesTags: [TAGS.Reports],
    }),

    /* ----------------------------------------------------------- search */
    globalSearch: builder.query({
      query: ({ q }) => ({ url: "/search", method: "GET", params: { q } }),
      transformResponse: (res) => ({
        groups: res?.groups ?? [],
        total: res?.total ?? 0,
      }),
      providesTags: [TAGS.Projects, TAGS.Tasks, TAGS.Invoices, TAGS.Documents],
    }),

    getSearchSuggestions: builder.query({
      query: ({ q }) => ({ url: "/search/suggestions", method: "GET", params: { q } }),
      transformResponse: (res) => res?.suggestions ?? [],
    }),

    /* ------------------------------------------------------------ audit */
    getAuditEvents: builder.query({
      query: (params = {}) => ({ url: "/audit", method: "GET", params }),
      transformResponse: (res) => ({
        events: res?.events ?? [],
        pagination: res?.pagination ?? null,
      }),
      providesTags: [TAGS.Audit],
    }),

    getAuditFacets: builder.query({
      query: () => ({ url: "/audit/facets", method: "GET" }),
      transformResponse: (res) => res?.facets ?? null,
      providesTags: [TAGS.Audit],
    }),

    /* -------------------------------------------------------- assistant */
    askAssistant: builder.mutation({
      query: ({ message }) => ({
        url: "/assistant/chat",
        method: "POST",
        body: { message },
      }),
      transformResponse: (res) => ({
        reply: res?.reply ?? "",
        suggestions: res?.suggestions ?? [],
        grounded: res?.grounded ?? false,
        role: res?.role ?? null,
      }),
    }),
  }),
});

export const {
  useGetNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useDeleteNotificationMutation,
  useGetOrganizationQuery,
  useUpdateOrganizationMutation,
  useGetNextNumbersQuery,
  useGetReportOverviewQuery,
  useGetReportIndexQuery,
  useGetProjectReportQuery,
  useGetFinanceReportQuery,
  useGetInventoryReportQuery,
  useGetSafetyReportQuery,
  useGetFieldReportQuery,
  useGlobalSearchQuery,
  useGetSearchSuggestionsQuery,
  useGetAuditEventsQuery,
  useGetAuditFacetsQuery,
  useAskAssistantMutation,
} = platformApi;
