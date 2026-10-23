import { baseApi, TAGS } from "../baseApi";

/**
 * Field operations: tasks, daily progress reports, inventory, equipment,
 * safety and the private document vault.
 *
 * Every read is scoped by the server to the caller's projects/sites, so the
 * browser never decides which records are visible.
 */
export const fieldApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /* ------------------------------------------------------------- tasks */
    getTasks: builder.query({
      query: (params = {}) => ({ url: "/task", method: "GET", params }),
      transformResponse: (res) => ({
        tasks: res?.tasks ?? [],
        pagination: res?.pagination ?? null,
      }),
      providesTags: (result) =>
        result?.tasks?.length
          ? [
              ...result.tasks.map((task) => ({ type: TAGS.Task, id: task._id })),
              TAGS.Tasks,
            ]
          : [TAGS.Tasks],
    }),

    getTask: builder.query({
      query: (id) => ({ url: `/task/${id}`, method: "GET" }),
      transformResponse: (res) => res?.task ?? null,
      providesTags: (_r, _e, id) => [{ type: TAGS.Task, id }],
    }),

    createTask: builder.mutation({
      query: (body) => ({ url: "/task", method: "POST", body }),
      invalidatesTags: [TAGS.Tasks, TAGS.Projects, TAGS.Dashboard],
    }),

    updateTask: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/task/${id}`, method: "PUT", body }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: TAGS.Task, id },
        TAGS.Tasks,
        TAGS.Projects,
        TAGS.Dashboard,
      ],
    }),

    deleteTask: builder.mutation({
      query: (id) => ({ url: `/task/${id}`, method: "DELETE" }),
      invalidatesTags: [TAGS.Tasks, TAGS.Projects, TAGS.Dashboard],
    }),

    /* ------------------------------------------------------ daily reports */
    getDailyReports: builder.query({
      query: (params = {}) => ({ url: "/daily-report", method: "GET", params }),
      transformResponse: (res) => ({
        reports: res?.reports ?? [],
        pagination: res?.pagination ?? null,
      }),
      pollingInterval: 60_000,
      providesTags: (result) =>
        result?.reports?.length
          ? [
              ...result.reports.map((report) => ({
                type: TAGS.DailyReport,
                id: report._id,
              })),
              TAGS.DailyReports,
              TAGS.Inventory,
            ]
          : [TAGS.DailyReports],
    }),

    getDailyReport: builder.query({
      query: (id) => ({ url: `/daily-report/${id}`, method: "GET" }),
      transformResponse: (res) => res?.report ?? null,
      providesTags: (_r, _e, id) => [{ type: TAGS.DailyReport, id }],
    }),

    createDailyReport: builder.mutation({
      query: (formData) => ({
        url: "/daily-report",
        method: "POST",
        body: formData,
      }),
      invalidatesTags: [TAGS.DailyReports, TAGS.Dashboard, TAGS.Reports],
    }),

    updateDailyReport: builder.mutation({
      query: ({ id, formData }) => ({
        url: `/daily-report/${id}`,
        method: "PUT",
        body: formData,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: TAGS.DailyReport, id },
        TAGS.DailyReports,
        TAGS.Dashboard,
      ],
    }),

    submitDailyReport: builder.mutation({
      query: (id) => ({ url: `/daily-report/${id}/submit`, method: "POST" }),
      invalidatesTags: [TAGS.DailyReports, TAGS.Dashboard, TAGS.Notifications],
    }),

    approveDailyReport: builder.mutation({
      query: (id) => ({ url: `/daily-report/${id}/approve`, method: "POST" }),
      invalidatesTags: [TAGS.DailyReports, TAGS.Inventory, TAGS.Dashboard, TAGS.Reports],
    }),

    rejectDailyReport: builder.mutation({
      query: ({ id, reason }) => ({
        url: `/daily-report/${id}/reject`,
        method: "POST",
        body: { reason },
      }),
      invalidatesTags: [TAGS.DailyReports, TAGS.Dashboard, TAGS.Notifications],
    }),

    deleteDailyReport: builder.mutation({
      query: (id) => ({ url: `/daily-report/${id}`, method: "DELETE" }),
      invalidatesTags: [TAGS.DailyReports, TAGS.Dashboard],
    }),

    /* --------------------------------------------------------- inventory */
    getMaterials: builder.query({
      query: (params = {}) => ({ url: "/material", method: "GET", params }),
      transformResponse: (res) => ({
        materials: res?.materials ?? [],
        pagination: res?.pagination ?? null,
      }),
      providesTags: [TAGS.Materials],
    }),

    getStock: builder.query({
      query: (params = {}) => ({ url: "/material/stock", method: "GET", params }),
      transformResponse: (res) => ({
        stock: res?.stock ?? [],
        site: res?.site ?? null,
        summary: res?.summary ?? null,
      }),
      providesTags: [TAGS.Inventory, TAGS.Materials],
    }),

    getLowStock: builder.query({
      query: (params = {}) => ({ url: "/material/low-stock", method: "GET", params }),
      transformResponse: (res) => res?.lowStock ?? [],
      providesTags: [TAGS.Inventory],
    }),

    getMovements: builder.query({
      query: (params = {}) => ({ url: "/material/movements", method: "GET", params }),
      transformResponse: (res) => ({
        movements: res?.movements ?? [],
        pagination: res?.pagination ?? null,
      }),
      providesTags: [TAGS.Inventory],
    }),

    createMovement: builder.mutation({
      query: (body) => ({ url: "/material/movements", method: "POST", body }),
      invalidatesTags: [TAGS.Inventory, TAGS.Materials, TAGS.Dashboard, TAGS.Reports],
    }),

    getMaterialStock: builder.query({
      query: ({ id, site }) => ({
        url: `/material/${id}/stock`,
        method: "GET",
        params: site ? { site } : undefined,
      }),
      transformResponse: (res) => ({
        material: res?.material ?? null,
        stock: res?.stock ?? null,
        recent: res?.recent ?? [],
      }),
      providesTags: [TAGS.Inventory],
    }),

    createMaterial: builder.mutation({
      query: (body) => ({ url: "/material", method: "POST", body }),
      invalidatesTags: [TAGS.Materials, TAGS.Inventory, TAGS.Dashboard],
    }),

    updateMaterial: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/material/${id}`, method: "PUT", body }),
      invalidatesTags: [TAGS.Materials, TAGS.Inventory, TAGS.Dashboard],
    }),

    archiveMaterial: builder.mutation({
      query: (id) => ({ url: `/material/${id}/archive`, method: "POST" }),
      invalidatesTags: [TAGS.Materials, TAGS.Inventory],
    }),

    /* --------------------------------------------------------- equipment */
    getEquipment: builder.query({
      query: (params = {}) => ({ url: "/equipment", method: "GET", params }),
      transformResponse: (res) => ({
        equipment: res?.equipment ?? [],
        pagination: res?.pagination ?? null,
      }),
      providesTags: [TAGS.Equipment],
    }),

    getEquipmentSummary: builder.query({
      query: () => ({ url: "/equipment/summary", method: "GET" }),
      transformResponse: (res) => res?.summary ?? null,
      providesTags: [TAGS.Equipment],
    }),

    createEquipment: builder.mutation({
      query: (body) => ({ url: "/equipment", method: "POST", body }),
      invalidatesTags: [TAGS.Equipment, TAGS.Dashboard],
    }),

    updateEquipment: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/equipment/${id}`, method: "PUT", body }),
      invalidatesTags: [TAGS.Equipment, TAGS.Dashboard],
    }),

    retireEquipment: builder.mutation({
      query: (id) => ({ url: `/equipment/${id}/retire`, method: "POST" }),
      invalidatesTags: [TAGS.Equipment, TAGS.Dashboard],
    }),

    /* ------------------------------------------------------------ safety */
    getSafetyIncidents: builder.query({
      query: (params = {}) => ({ url: "/safety", method: "GET", params }),
      transformResponse: (res) => ({
        incidents: res?.incidents ?? [],
        pagination: res?.pagination ?? null,
      }),
      providesTags: [TAGS.Safety],
    }),

    getSafetySummary: builder.query({
      query: () => ({ url: "/safety/summary", method: "GET" }),
      transformResponse: (res) => res?.summary ?? null,
      providesTags: [TAGS.Safety],
    }),

    createSafetyIncident: builder.mutation({
      query: (body) => ({ url: "/safety", method: "POST", body }),
      invalidatesTags: [TAGS.Safety, TAGS.Dashboard, TAGS.Notifications],
    }),

    updateSafetyIncident: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/safety/${id}`, method: "PUT", body }),
      invalidatesTags: [TAGS.Safety, TAGS.Dashboard],
    }),

    deleteSafetyIncident: builder.mutation({
      query: (id) => ({ url: `/safety/${id}`, method: "DELETE" }),
      invalidatesTags: [TAGS.Safety, TAGS.Dashboard],
    }),

    /* --------------------------------------------------------- documents */
    getDocuments: builder.query({
      query: (params = {}) => ({ url: "/document", method: "GET", params }),
      transformResponse: (res) => ({
        documents: res?.documents ?? [],
        pagination: res?.pagination ?? null,
      }),
      providesTags: [TAGS.Documents],
    }),

    uploadDocument: builder.mutation({
      query: (formData) => ({ url: "/document", method: "POST", body: formData }),
      invalidatesTags: [TAGS.Documents, TAGS.Project],
    }),

    updateDocument: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/document/${id}`, method: "PUT", body }),
      invalidatesTags: [TAGS.Documents, TAGS.Project],
    }),

    deleteDocument: builder.mutation({
      query: (id) => ({ url: `/document/${id}`, method: "DELETE" }),
      invalidatesTags: [TAGS.Documents, TAGS.Project],
    }),
  }),
});

export const {
  useGetTasksQuery,
  useGetTaskQuery,
  useCreateTaskMutation,
  useUpdateTaskMutation,
  useDeleteTaskMutation,
  useGetDailyReportsQuery,
  useGetDailyReportQuery,
  useCreateDailyReportMutation,
  useUpdateDailyReportMutation,
  useSubmitDailyReportMutation,
  useApproveDailyReportMutation,
  useRejectDailyReportMutation,
  useDeleteDailyReportMutation,
  useGetMaterialsQuery,
  useGetStockQuery,
  useGetLowStockQuery,
  useGetMovementsQuery,
  useCreateMovementMutation,
  useGetMaterialStockQuery,
  useCreateMaterialMutation,
  useUpdateMaterialMutation,
  useArchiveMaterialMutation,
  useGetEquipmentQuery,
  useGetEquipmentSummaryQuery,
  useCreateEquipmentMutation,
  useUpdateEquipmentMutation,
  useRetireEquipmentMutation,
  useGetSafetyIncidentsQuery,
  useGetSafetySummaryQuery,
  useCreateSafetyIncidentMutation,
  useUpdateSafetyIncidentMutation,
  useDeleteSafetyIncidentMutation,
  useGetDocumentsQuery,
  useUploadDocumentMutation,
  useUpdateDocumentMutation,
  useDeleteDocumentMutation,
} = fieldApi;
