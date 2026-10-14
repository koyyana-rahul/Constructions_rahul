import { baseApi } from "../baseApi";

/**
 * Account settings.
 *
 * Self-service only: the identity comes from the verified token, so the
 * payload never carries a user id that the server would have to trust.
 */
export const settingsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    changePassword: builder.mutation({
      query: ({ oldPassword, newPassword }) => ({
        url: "/setting/change-password",
        method: "PUT",
        body: { oldPassword, newPassword },
      }),
      transformResponse: (res) => res?.message ?? "Password updated.",
    }),
  }),
});

export const { useChangePasswordMutation } = settingsApi;