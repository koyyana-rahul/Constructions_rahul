import { baseApi, TAGS } from "../baseApi";

/**
 * Projects are the execution core of the platform.
 *
 * The list endpoint is role-scoped on the server, so the same query is safe
 * for an administrator, an employee and a client. Financial fields are
 * stripped server-side for non-administrators; the UI never receives them.
 */
export const projectsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getProjects: builder.query({
      query: (params = {}) => ({ url: "/project", method: "GET", params }),
      transformResponse: (res) => ({
        projects: res?.projects ?? [],
        pagination: res?.pagination ?? null,
      }),
      pollingInterval: 60_000,
      providesTags: (result) =>
        result?.projects?.length
          ? [
              ...result.projects.map((project) => ({ type: TAGS.Project, id: project._id })),
              TAGS.Projects,
            ]
          : [TAGS.Projects],
    }),

    getProject: builder.query({
      query: (id) => ({ url: `/project/${id}`, method: "GET" }),
      transformResponse: (res) => res?.project ?? null,
      providesTags: (_r, _e, id) => [{ type: TAGS.Project, id }, TAGS.Projects],
    }),

    getWorkRequestPrefill: builder.query({
      query: (workRequestId) => ({
        url: `/project/prefill/work-request/${workRequestId}`,
        method: "GET",
      }),
      transformResponse: (res) => res?.draft ?? null,
    }),

    createProject: builder.mutation({
      query: (body) => ({ url: "/project", method: "POST", body }),
      invalidatesTags: [TAGS.Projects, TAGS.Dashboard, TAGS.Reports, TAGS.WorkRequests],
    }),

    updateProject: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/project/${id}`, method: "PUT", body }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: TAGS.Project, id },
        TAGS.Projects,
        TAGS.Dashboard,
        TAGS.Reports,
      ],
    }),

    archiveProject: builder.mutation({
      query: ({ id, reason }) => ({
        url: `/project/${id}/archive`,
        method: "POST",
        body: { reason },
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: TAGS.Project, id },
        TAGS.Projects,
        TAGS.Dashboard,
        TAGS.Reports,
      ],
    }),

    restoreProject: builder.mutation({
      query: (id) => ({ url: `/project/${id}/restore`, method: "POST" }),
      invalidatesTags: (_r, _e, id) => [
        { type: TAGS.Project, id },
        TAGS.Projects,
        TAGS.Dashboard,
      ],
    }),

    deleteProject: builder.mutation({
      query: (id) => ({ url: `/project/${id}`, method: "DELETE" }),
      invalidatesTags: [TAGS.Projects, TAGS.Dashboard, TAGS.Reports],
    }),

    addMilestone: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/project/${id}/milestones`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: TAGS.Project, id },
        TAGS.Projects,
        TAGS.Dashboard,
      ],
    }),

    updateMilestone: builder.mutation({
      query: ({ id, milestoneId, ...body }) => ({
        url: `/project/${id}/milestones/${milestoneId}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: TAGS.Project, id },
        TAGS.Projects,
        TAGS.Dashboard,
      ],
    }),

    deleteMilestone: builder.mutation({
      query: ({ id, milestoneId }) => ({
        url: `/project/${id}/milestones/${milestoneId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: TAGS.Project, id },
        TAGS.Projects,
        TAGS.Dashboard,
      ],
    }),
  }),
});

export const {
  useGetProjectsQuery,
  useGetProjectQuery,
  useGetWorkRequestPrefillQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useArchiveProjectMutation,
  useRestoreProjectMutation,
  useDeleteProjectMutation,
  useAddMilestoneMutation,
  useUpdateMilestoneMutation,
  useDeleteMilestoneMutation,
} = projectsApi;
