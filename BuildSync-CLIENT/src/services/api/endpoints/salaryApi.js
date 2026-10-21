import { baseApi, TAGS } from "../baseApi";

/**
 * Payroll.
 *
 * `GET /salary/:id/:role` keeps its legacy signature; `:role` is ignored by the
 * server, which resolves payroll from the verified token unless the caller is
 * an admin explicitly asking for another employee (`?scope=admin`). The cache
 * key still contains the employee id and the role, so the admin view and the
 * employee's self-service view are separate entries and can never be confused.
 */
export const salaryApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getSalary: builder.query({
      query: ({ id, role }) => ({
        url: `/salary/${id}/${role}`,
        method: "GET",
        params: role === "admin" ? { scope: "admin" } : undefined,
      }),
      transformResponse: (res) => res?.salary ?? [],
      providesTags: (_r, _e, { id }) => [{ type: TAGS.Salary, id }],
    }),

    addSalary: builder.mutation({
      query: (body) => ({ url: "/salary/add", method: "POST", body }),
      invalidatesTags: (result, _e, body) => [
        { type: TAGS.Salary, id: body?.employeeId },
        TAGS.Salary,
        TAGS.Dashboard,
      ],
    }),
  }),
});

export const { useGetSalaryQuery, useAddSalaryMutation } = salaryApi;