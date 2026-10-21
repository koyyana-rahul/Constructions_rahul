import { baseApi, TAGS } from "../baseApi";

/**
 * Client organisations and individuals.
 *
 * The API scopes `GET /client` to the caller's own record for the `client`
 * role, and `GET /client/:id` enforces ownership server-side, so the frontend
 * never has to filter by a user-supplied identity.
 */
export const clientsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getClients: builder.query({
      query: ({ limit = 100 } = {}) => ({
        url: "/client",
        method: "GET",
        params: { limit },
      }),
      transformResponse: (res) => res?.clients ?? [],
      providesTags: [TAGS.Clients],
    }),

    getClient: builder.query({
      query: (id) => ({ url: `/client/${id}`, method: "GET" }),
      transformResponse: (res) => res?.client ?? null,
      providesTags: (_r, _e, id) => [{ type: TAGS.Client, id }, TAGS.Clients],
    }),

    /** Returns the one-time activation link so the admin can deliver it. */
    addClient: builder.mutation({
      query: (formData) => ({ url: "/client/add", method: "POST", body: formData }),
      invalidatesTags: [TAGS.Clients, TAGS.Dashboard],
    }),

    updateClient: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/client/${id}`, method: "PUT", body }),
      invalidatesTags: (result, _e, { id }) => [
        { type: TAGS.Client, id },
        TAGS.Clients,
      ],
    }),

    deleteClient: builder.mutation({
      query: (id) => ({ url: `/client/${id}`, method: "DELETE" }),
      invalidatesTags: [TAGS.Clients, TAGS.WorkRequests, TAGS.Dashboard],
    }),
  }),
});

export const {
  useGetClientsQuery,
  useGetClientQuery,
  useAddClientMutation,
  useUpdateClientMutation,
  useDeleteClientMutation,
} = clientsApi;