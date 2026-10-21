import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { baseApi } from "../../services/api/baseApi";
import { useLogoutMutation } from "../../services/api/endpoints/authApi";
import { sessionCleared } from "./authSlice";
import { selectCurrentUser } from "./authSelectors";

/**
 * Convenience view of the signed-in account.
 *
 * Replaces `useAuth()` from the removed AuthContext. It is a thin selector
 * wrapper - no state of its own - so there is exactly one source of truth for
 * the session: `state.auth`.
 */
export const useCurrentUser = () => useAppSelector(selectCurrentUser);

/**
 * Ends the session.
 *
 * Two things have to happen, in this order:
 *
 *   1. `POST /auth/logout` clears the httpOnly cookie. This is the part that
 *      actually ends the session - the JWT is stateless, so the cookie is the
 *      only thing that has to be destroyed. Skipping it would leave a valid
 *      token sitting in the browser until it expired.
 *   2. The Redux slice is cleared and the RTK Query cache is dropped, so the
 *      UI cannot keep rendering the previous account's records.
 *
 * The cache reset matters: without it the next sign-in could briefly render
 * the previous account's lists out of memory.
 */
export const useSignOut = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [logout] = useLogoutMutation();

  return useCallback(async () => {
    try {
      // The server clears the cookie. A failure here must not strand the
      // user in a half-signed-out state, so the local cleanup always runs.
      await logout().unwrap();
    } catch {
      /* the cookie will expire on its own; carry on clearing locally */
    }

    dispatch(sessionCleared());
    dispatch(baseApi.util.resetApiState());
    navigate("/login", { replace: true });
  }, [dispatch, navigate, logout]);
};
