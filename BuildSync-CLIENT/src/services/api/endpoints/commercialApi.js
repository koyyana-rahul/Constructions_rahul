import { baseApi, TAGS } from "../baseApi";

/**
 * Commercial modules: vendors, project spend and client invoices.
 *
 * These endpoints are administrator-only except the invoice reads, which the
 * server scopes to the signed-in client. Costs and receipt files never enter
 * an employee or client session.
 */
export const commercialApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /* ------------------------------------------------------------ vendors */
    getVendors: builder.query({
      query: (params = {}) => ({ url: "/vendor", method: "GET", params }),
      transformResponse: (res) => ({
        vendors: res?.vendors ?? [],
        pagination: res?.pagination ?? null,
      }),
      providesTags: [TAGS.Vendors],
    }),

    createVendor: builder.mutation({
      query: (body) => ({ url: "/vendor", method: "POST", body }),
      invalidatesTags: [TAGS.Vendors, TAGS.Dashboard],
    }),

    updateVendor: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/vendor/${id}`, method: "PUT", body }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: TAGS.Vendor, id },
        TAGS.Vendors,
      ],
    }),

    archiveVendor: builder.mutation({
      query: (id) => ({ url: `/vendor/${id}/archive`, method: "POST" }),
      invalidatesTags: [TAGS.Vendors],
    }),

    deleteVendor: builder.mutation({
      query: (id) => ({ url: `/vendor/${id}`, method: "DELETE" }),
      invalidatesTags: [TAGS.Vendors],
    }),

    /* ----------------------------------------------------------- expenses */
    getExpenses: builder.query({
      query: (params = {}) => ({ url: "/expense", method: "GET", params }),
      transformResponse: (res) => ({
        expenses: res?.expenses ?? [],
        pagination: res?.pagination ?? null,
      }),
      providesTags: [TAGS.Expenses],
    }),

    getExpenseSummary: builder.query({
      query: (params = {}) => ({ url: "/expense/summary", method: "GET", params }),
      transformResponse: (res) => res?.summary ?? null,
      providesTags: [TAGS.Expenses],
    }),

    createExpense: builder.mutation({
      query: (formData) => ({ url: "/expense", method: "POST", body: formData }),
      invalidatesTags: [TAGS.Expenses, TAGS.Projects, TAGS.Dashboard, TAGS.Reports],
    }),

    updateExpense: builder.mutation({
      query: ({ id, formData }) => ({
        url: `/expense/${id}`,
        method: "PUT",
        body: formData,
      }),
      invalidatesTags: [TAGS.Expenses, TAGS.Projects, TAGS.Dashboard, TAGS.Reports],
    }),

    approveExpense: builder.mutation({
      query: (id) => ({ url: `/expense/${id}/approve`, method: "POST" }),
      invalidatesTags: [TAGS.Expenses, TAGS.Projects, TAGS.Dashboard, TAGS.Reports],
    }),

    rejectExpense: builder.mutation({
      query: ({ id, reason }) => ({
        url: `/expense/${id}/reject`,
        method: "POST",
        body: { reason },
      }),
      invalidatesTags: [TAGS.Expenses, TAGS.Projects, TAGS.Dashboard],
    }),

    markExpensePaid: builder.mutation({
      query: (id) => ({ url: `/expense/${id}/paid`, method: "POST" }),
      invalidatesTags: [TAGS.Expenses, TAGS.Projects, TAGS.Dashboard, TAGS.Reports],
    }),

    deleteExpense: builder.mutation({
      query: (id) => ({ url: `/expense/${id}`, method: "DELETE" }),
      invalidatesTags: [TAGS.Expenses, TAGS.Projects, TAGS.Dashboard],
    }),

    /* ----------------------------------------------------------- invoices */
    getInvoices: builder.query({
      query: (params = {}) => ({ url: "/invoice", method: "GET", params }),
      transformResponse: (res) => ({
        invoices: res?.invoices ?? [],
        pagination: res?.pagination ?? null,
      }),
      pollingInterval: 60_000,
      providesTags: [TAGS.Invoices],
    }),

    getInvoice: builder.query({
      query: (id) => ({ url: `/invoice/${id}`, method: "GET" }),
      transformResponse: (res) => ({
        invoice: res?.invoice ?? null,
        organization: res?.organization ?? null,
      }),
      providesTags: (_r, _e, id) => [{ type: TAGS.Invoice, id }],
    }),

    getInvoiceSummary: builder.query({
      query: () => ({ url: "/invoice/summary", method: "GET" }),
      transformResponse: (res) => res?.summary ?? null,
      providesTags: [TAGS.Invoices],
    }),

    createInvoice: builder.mutation({
      query: (body) => ({ url: "/invoice", method: "POST", body }),
      invalidatesTags: [TAGS.Invoices, TAGS.Projects, TAGS.Dashboard, TAGS.Reports],
    }),

    updateInvoice: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/invoice/${id}`, method: "PUT", body }),
      invalidatesTags: (_result, _error, { id }) => [
        TAGS.Invoices,
        { type: TAGS.Invoice, id },
        TAGS.Projects,
        TAGS.Dashboard,
      ],
    }),

    sendInvoice: builder.mutation({
      query: (id) => ({ url: `/invoice/${id}/send`, method: "POST" }),
      invalidatesTags: (_result, _error, id) => [
        TAGS.Invoices,
        { type: TAGS.Invoice, id },
        TAGS.Dashboard,
        TAGS.Notifications,
      ],
    }),

    recordInvoicePayment: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/invoice/${id}/payments`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        TAGS.Invoices,
        { type: TAGS.Invoice, id },
        TAGS.Projects,
        TAGS.Dashboard,
        TAGS.Reports,
      ],
    }),

    cancelInvoice: builder.mutation({
      query: ({ id, reason }) => ({
        url: `/invoice/${id}/cancel`,
        method: "POST",
        body: { reason },
      }),
      invalidatesTags: (_result, _error, { id }) => [
        TAGS.Invoices,
        { type: TAGS.Invoice, id },
        TAGS.Projects,
        TAGS.Dashboard,
      ],
    }),

    deleteInvoice: builder.mutation({
      query: (id) => ({ url: `/invoice/${id}`, method: "DELETE" }),
      invalidatesTags: (_result, _error, id) => [
        TAGS.Invoices,
        { type: TAGS.Invoice, id },
        TAGS.Projects,
        TAGS.Dashboard,
      ],
    }),
  }),
});

export const {
  useGetVendorsQuery,
  useCreateVendorMutation,
  useUpdateVendorMutation,
  useArchiveVendorMutation,
  useDeleteVendorMutation,
  useGetExpensesQuery,
  useGetExpenseSummaryQuery,
  useCreateExpenseMutation,
  useUpdateExpenseMutation,
  useApproveExpenseMutation,
  useRejectExpenseMutation,
  useMarkExpensePaidMutation,
  useDeleteExpenseMutation,
  useGetInvoicesQuery,
  useGetInvoiceQuery,
  useGetInvoiceSummaryQuery,
  useCreateInvoiceMutation,
  useUpdateInvoiceMutation,
  useSendInvoiceMutation,
  useRecordInvoicePaymentMutation,
  useCancelInvoiceMutation,
  useDeleteInvoiceMutation,
} = commercialApi;
