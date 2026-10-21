import { baseApi, TAGS } from "../baseApi";

/**
 * Leave requests.
 *
 * Two distinct reads exist because the backend enforces two different scopes:
 *   - `getLeaves`     the admin queue (all employees).
 *   - `getEmployeeLeaves` a person's own history. For a non-admin the server
 *     IGNORES the id in the URL and resolves the employee from the verified
 *     token, so swapping the URL segment cannot reveal another worker's
 *     history. For an admin it genuinely scopes to the selected employee.
 *
 * Both cache entries are tagged `Leaves` plus their own scope, so a decision
 * invalidates the admin queue, the affected employee's history and the
 * dashboard counts in one step.
 */
export const leavesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getLeaves: builder.query({
      query: ({ limit = 100 } = {}) => ({
        url: "/leave",
        method: "GET",
        params: { limit },
      }),
      transformResponse: (res) => res?.leaves ?? [],
      // Another admin's approval must appear without a manual refresh.
      pollingInterval: 30_000,
      providesTags: [TAGS.Leaves],
    }),

    getEmployeeLeaves: builder.query({
      query: ({ id, role }) => ({ url: `/leave/${id}/${role}`, method: "GET" }),
      transformResponse: (res) => res?.leaves ?? [],
      providesTags: (_r, _e, { id }) => [{ type: TAGS.Leaves, id }],
    }),

    getLeaveById: builder.query({
      query: (id) => ({ url: `/leave/detail/${id}`, method: "GET" }),
      transformResponse: (res) => res?.leave ?? null,
      providesTags: (_r, _e, id) => [{ type: TAGS.Leave, id }],
    }),

    addLeave: builder.mutation({
      query: (body) => ({ url: "/leave/add", method: "POST", body }),
      // `userId` is accepted for backwards compatibility with the existing
      // payload but the backend derives ownership from the token.
      invalidatesTags: [TAGS.Leaves, TAGS.Dashboard],
    }),

    updateLeaveStatus: builder.mutation({
      query: ({ id, status }) => ({ url: `/leave/${id}`, method: "PUT", body: { status } }),
      invalidatesTags: (result, _e, { id }) => [
        { type: TAGS.Leave, id },
        TAGS.Leaves,
        TAGS.Dashboard,
      ],
    }),

    cancelLeave: builder.mutation({
      query: (id) => ({ url: `/leave/${id}/cancel`, method: "PUT" }),
      invalidatesTags: (result, _e, id) => [
        { type: TAGS.Leave, id },
        TAGS.Leaves,
        TAGS.Dashboard,
      ],
    }),
  }),
});

export const {
  useGetLeavesQuery,
  useGetEmployeeLeavesQuery,
  useGetLeaveByIdQuery,
  useAddLeaveMutation,
  useUpdateLeaveStatusMutation,
  useCancelLeaveMutation,
} = leavesApi;