import { baseApi, TAGS } from "../baseApi";
import { setSessionHint } from "../../../lib/api";
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
            setSessionHint();
            dispatch(sessionAuthenticated(data.user));
          }
        } catch {
          /* the mutation result carries the error for the form to render */
        }
      },
    }),

    forgotPassword: builder.mutation({
      query: (body) => ({ url: "/auth/forgot-password", method: "POST", body }),
      // The server deliberately returns the same response for every address.
      // The reset token is only ever delivered by email, never in JSON.
      transformResponse: (res) => ({
        message:
          res?.message ??
          "If an account exists for that email address, a password reset link has been sent.",
      }),
    }),

    resetPassword: builder.mutation({
      query: (body) => ({ url: "/auth/reset-password", method: "POST", body }),
      transformResponse: (res) => res?.message ?? "Password updated.",
    }),

    verifyActivationToken: builder.query({
      query: (token) => ({ url: "/auth/activate", method: "GET", params: { token } }),
      // Only the identity fields the activation form displays. The server
      // never returns the token itself or any credential material.
      transformResponse: (res) => ({
        name: res?.name ?? res?.user?.name ?? null,
        email: res?.email ?? res?.user?.email ?? null,
        expiresAt: res?.expiresAt ?? null,
        valid: Boolean(res?.valid ?? res?.success),
      }),
    }),

    activateAccount: builder.mutation({
      query: (body) => ({ url: "/auth/activate", method: "POST", body }),
      transformResponse: (res) => res?.message ?? "Account activated.",
    }),

    /**
     * Sign-out. The server clears the httpOnly session cookie - this is what
     * actually ends the session.
     */
    logout: builder.mutation({
      query: () => ({ url: "/auth/logout", method: "POST" }),
      transformResponse: (res) => res?.message ?? "Signed out",
    }),

    resendInvitation: builder.mutation({
      query: (userId) => ({
        url: `/auth/invitations/${userId}/resend`,
        method: "POST",
      }),
      transformResponse: (res) => ({
        activationToken: res?.activationToken ?? null,
        expiresAt: res?.expiresAt ?? null,
        message: res?.message ?? "Invitation re-issued.",
        emailDelivery: res?.emailDelivery ?? null,
      }),
      invalidatesTags: [TAGS.Clients, TAGS.Employees],
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
  useLogoutMutation,
  useResendInvitationMutation,
} = authApi;