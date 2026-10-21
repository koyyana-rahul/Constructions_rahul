import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { baseApi } from "../../services/api/baseApi";
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
 * Ends the session: clears the stored JWT, empties the auth slice and drops
 * every cached server record.
 *
 * Resetting the cache is the important half - without it the next sign-in
 * could briefly render the previous account's lists out of memory.
 */
export const useSignOut = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  return useCallback(() => {
    dispatch(sessionCleared());
    dispatch(baseApi.util.resetApiState());
    navigate("/login", { replace: true });
  }, [dispatch, navigate]);
};