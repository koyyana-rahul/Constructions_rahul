import { baseApi, TAGS } from "../baseApi";

/**
 * Workforce records.
 *
 * Every employee-scoped screen (profile, leave, payroll, attendance) resolves
 * its identity through `getEmployee(id)`, whose cache key is the employee's
 * `_id` - the same identifier the leave/payroll/attendance endpoints use. That
 * is what guarantees the identity header and the records beneath it always
 * describe the same person, including after a direct URL load or a refresh.
 */
export const employeesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getEmployees: builder.query({
      query: ({ limit = 100 } = {}) => ({
        url: "/employee",
        method: "GET",
        params: { limit },
      }),
      transformResponse: (res) => res?.employees ?? [],
      providesTags: [TAGS.Employees],
    }),

    getEmployee: builder.query({
      query: (id) => ({ url: `/employee/${id}`, method: "GET" }),
      transformResponse: (res) => res?.employee ?? null,
      providesTags: (_r, _e, id) => [{ type: TAGS.Employee, id }, TAGS.Employees],
    }),

    /** Employees assigned to a site - populates the payroll form's picker. */
    getEmployeesByDepartment: builder.query({
      query: (departmentId) => ({
        url: `/employee/department/${departmentId}`,
        method: "GET",
      }),
      transformResponse: (res) => res?.employees ?? [],
      providesTags: [TAGS.Employees],
    }),

    addEmployee: builder.mutation({
      query: (formData) => ({ url: "/employee/add", method: "POST", body: formData }),
      invalidatesTags: [TAGS.Employees, TAGS.Departments, TAGS.Dashboard],
    }),

    updateEmployee: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/employee/${id}`, method: "PUT", body }),
      invalidatesTags: (result, _e, { id }) => [
        { type: TAGS.Employee, id },
        TAGS.Employees,
        TAGS.Departments,
        TAGS.Dashboard,
      ],
    }),
  }),
});

export const {
  useGetEmployeesQuery,
  useGetEmployeeQuery,
  useGetEmployeesByDepartmentQuery,
  useAddEmployeeMutation,
  useUpdateEmployeeMutation,
} = employeesApi;