import { baseApi, TAGS } from "../baseApi";

/**
 * Construction sites (the `department` collection in the API).
 *
 * A site is referenced by employees, leave, attendance and payroll, so every
 * write invalidates the collection plus the derived counts.
 */
export const departmentsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDepartments: builder.query({
      query: ({ includeArchived = false } = {}) => ({
        url: "/department",
        method: "GET",
        params: includeArchived ? { includeArchived: true } : undefined,
      }),
      transformResponse: (res) => res?.departments ?? [],
      providesTags: [TAGS.Departments],
    }),

    getDepartment: builder.query({
      query: (id) => ({ url: `/department/${id}`, method: "GET" }),
      transformResponse: (res) => res?.department ?? null,
      providesTags: (_r, _e, id) => [{ type: TAGS.Department, id }],
    }),

    addDepartment: builder.mutation({
      query: (body) => ({ url: "/department/add", method: "POST", body }),
      invalidatesTags: [TAGS.Departments, TAGS.Dashboard],
    }),

    updateDepartment: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/department/${id}`, method: "PUT", body }),
      invalidatesTags: (result, _e, { id }) => [
        { type: TAGS.Department, id },
        TAGS.Departments,
        TAGS.Dashboard,
      ],
    }),

    setDepartmentArchived: builder.mutation({
      query: ({ id, archive }) => ({
        url: `/department/${id}/${archive ? "archive" : "restore"}`,
        method: "PUT",
      }),
      invalidatesTags: (result, _e, { id }) => [
        { type: TAGS.Department, id },
        TAGS.Departments,
        TAGS.Employees,
        TAGS.Attendance,
        TAGS.Dashboard,
      ],
    }),

    deleteDepartment: builder.mutation({
      query: (id) => ({ url: `/department/${id}`, method: "DELETE" }),
      invalidatesTags: [TAGS.Departments, TAGS.Employees, TAGS.Dashboard],
    }),
  }),
});

export const {
  useGetDepartmentsQuery,
  useGetDepartmentQuery,
  useAddDepartmentMutation,
  useUpdateDepartmentMutation,
  useSetDepartmentArchivedMutation,
  useDeleteDepartmentMutation,
} = departmentsApi;