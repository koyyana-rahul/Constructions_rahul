import { baseApi, TAGS } from "../baseApi";

/**
 * Daily attendance.
 *
 * The optional `employeeId` filter is applied in the Mongo query by the server,
 * not in the browser, so the per-employee page can only ever receive that
 * employee's rows.
 */
export const attendanceApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAttendance: builder.query({
      query: ({ employeeId } = {}) => ({
        url: "/attendance",
        method: "GET",
        params: employeeId ? { employeeId } : undefined,
      }),
      transformResponse: (res) => res?.attendance ?? [],
      // The default-attendance middleware is idempotent, so a slow poll is safe
      // and keeps every marker looking at the same sheet.
      pollingInterval: 30_000,
      providesTags: (result, _e, { employeeId } = {}) =>
        employeeId
          ? [{ type: TAGS.Attendance, id: employeeId }, TAGS.Attendance]
          : [TAGS.Attendance],
    }),

    getAttendanceReport: builder.query({
      query: ({ date, page = 1, limit = 5 } = {}) => ({
        url: "/attendance/report",
        method: "GET",
        params: { date: date || undefined, page, limit },
      }),
      transformResponse: (res) => res?.groupData ?? {},
      providesTags: [TAGS.AttendanceReport, TAGS.Attendance],
    }),

    updateAttendance: builder.mutation({
      query: ({ employeeId, status }) => ({
        url: `/attendance/update/${employeeId}`,
        method: "PUT",
        body: { status },
      }),
      invalidatesTags: (result, _e, { employeeId }) => [
        { type: TAGS.Attendance, id: employeeId },
        TAGS.Attendance,
        TAGS.Dashboard,
      ],
    }),
  }),
});

export const {
  useGetAttendanceQuery,
  useGetAttendanceReportQuery,
  useUpdateAttendanceMutation,
} = attendanceApi;