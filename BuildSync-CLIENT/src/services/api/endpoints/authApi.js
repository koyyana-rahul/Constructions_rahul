import { baseApi, TAGS } from "../baseApi";
import { setToken } from "../../../lib/api";
import { sessionAuthenticated } from "../../../features/auth/authSlice";

/**
 * Unauthenticated (sign-in / password recovery / invitation activation) plus
 * the one authenticated read that defines whether a stored token is still
 * valid.
 *
 * `verifySession` is skipped entirely when no token exists, so a signed-out
 * visitor never issues a 401 just to be told they are signed out.
 */
export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    verifySession: builder.query({
      query: () => ({ url: "/auth/verify", method: "GET" }),
      transformResponse: (res) => res?.user ?? null,
      providesTags: (result) => (result ? [{ type: "Auth", id: result._id }] : []),
    }),

    login: builder.mutation({
      query: ({ email, password }) => ({
        url: "/auth/login",
        method: "POST",
        body: { email, password },
      }),
      transformResponse: (res) => ({
        user: res?.user ?? null,
        token: res?.token ?? null,
      }),
      // The token has to exist before any subsequent request can be
      // authenticated, and the slice must be updated before the route guard
      // re-evaluates - otherwise navigating to the dashboard bounces to
      // /login.
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (data?.token) {
            setToken(data.token);
            dispatch(sessionAuthenticated(data.user));
          }
        } catch {
          /* the mutation result carries the error for the form to render */
        }
      },
    }),

    forgotPassword: builder.mutation({
      query: (body) => ({ url: "/auth/forgot-password", method: "POST", body }),
      transformResponse: (res) => res?.message ?? "Password reset link sent.",
    }),

    resetPassword: builder.mutation({
      query: (body) => ({ url: "/auth/reset-password", method: "POST", body }),
      transformResponse: (res) => res?.message ?? "Password updated.",
    }),

    verifyActivationToken: builder.query({
      query: (token) => ({ url: "/auth/activate", method: "GET", params: { token } }),
      transformResponse: (res) => ({
        email: res?.email ?? res?.user?.email ?? null,
        valid: Boolean(res?.valid ?? res?.success),
      }),
    }),

    activateAccount: builder.mutation({
      query: (body) => ({ url: "/auth/activate", method: "POST", body }),
      transformResponse: (res) => res?.message ?? "Account activated.",
    }),

    resendInvitation: builder.mutation({
      query: (userId) => ({
        url: `/auth/invitations/${userId}/resend`,
        method: "POST",
      }),
      transformResponse: (res) => ({ activationToken: res?.activationToken ?? null }),
      invalidatesTags: [TAGS.Clients],
    }),
  }),
});

export const {
  useVerifySessionQuery,
  useLoginMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useVerifyActivationTokenQuery,
  useActivateAccountMutation,
  useResendInvitationMutation,
} = authApi;