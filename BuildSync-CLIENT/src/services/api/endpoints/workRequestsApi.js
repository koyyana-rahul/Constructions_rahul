import { baseApi, TAGS } from "../baseApi";

/**
 * Client work requests.
 *
 * As with leave, two reads exist for two server-enforced scopes: the admin
 * queue (`GET /work-request`) and one client's own requests
 * (`GET /work-request/:id/:role`, which the server resolves from the token for
 * non-admins).
 */
export const workRequestsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getWorkRequests: builder.query({
      query: ({ limit = 100 } = {}) => ({
        url: "/work-request",
        method: "GET",
        params: { limit },
      }),
      transformResponse: (res) => res?.requests ?? [],
      // A client submitting a request must reach the admin queue promptly.
      pollingInterval: 30_000,
      providesTags: [TAGS.WorkRequests],
    }),

    getClientWorkRequests: builder.query({
      query: ({ id, role }) => ({ url: `/work-request/${id}/${role}`, method: "GET" }),
      transformResponse: (res) => res?.requests ?? [],
      // The admin's decision must reach the client without a reload.
      pollingInterval: 30_000,
      providesTags: (_r, _e, { id }) => [{ type: TAGS.WorkRequests, id }],
    }),

    getWorkRequestById: builder.query({
      query: (id) => ({ url: `/work-request/detail/${id}`, method: "GET" }),
      transformResponse: (res) => res?.request ?? res?.workRequest ?? null,
      providesTags: (_r, _e, id) => [{ type: TAGS.WorkRequest, id }],
    }),

    addWorkRequest: builder.mutation({
      query: (formData) => ({ url: "/work-request/add", method: "POST", body: formData }),
      invalidatesTags: [TAGS.WorkRequests, TAGS.Dashboard],
    }),

    updateWorkRequest: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/work-request/${id}`, method: "PUT", body }),
      invalidatesTags: (result, _e, { id }) => [
        { type: TAGS.WorkRequest, id },
        TAGS.WorkRequests,
        TAGS.Dashboard,
      ],
    }),
  }),
});

export const {
  useGetWorkRequestsQuery,
  useGetClientWorkRequestsQuery,
  useGetWorkRequestByIdQuery,
  useAddWorkRequestMutation,
  useUpdateWorkRequestMutation,
} = workRequestsApi;