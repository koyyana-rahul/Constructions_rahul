import { createSelector } from "@reduxjs/toolkit";
import { baseApi } from "../../services/api/baseApi";

/* ---------------------------------------------------------------- Session */

export const selectAuthStatus = (state) => state.auth.status;

export const selectCurrentUser = (state) => state.auth.user;

export const selectIsAuthenticated = (state) => state.auth.status === "authenticated";

/** Still resolving the stored token - route guards must wait for this. */
export const selectIsSessionPending = (state) => state.auth.status !== "anonymous";

export const selectUserRole = (state) => state.auth.user?.role ?? null;

/**
 * Home route for a role.
 *
 * Exported as a plain function as well as a selector, because the sign-in
 * page needs it BEFORE the store has been updated - reading the selector
 * there would capture the pre-login value ("/login") and bounce the user
 * straight back to the sign-in screen.
 */
export const homePathForRole = (role) => {
  if (role === "admin") return "/admin-dashboard";
  if (role === "employee") return "/employee-dashboard";
  if (role === "client") return "/client-dashboard";
  return "/login";
};

/** Home route for a role. Drives both the post-login redirect and 403 recovery. */
export const selectHomePath = createSelector([selectUserRole], homePathForRole);

/* ---------------------------------------------------------- RTK Query state */

/**
 * `isFetching` split by reason, so a page can show a subtle "Syncing…" hint
 * for background refreshes while keeping existing rows on screen, instead of
 * throwing the whole list away into a skeleton.
 */
export const makeQueryStateSelectors = (hook) => {
  const selectIsFetching = (arg) => hook(arg)?.isFetching;
  const selectIsLoading = (arg) => hook(arg)?.isLoading;
  const selectError = (arg) => hook(arg)?.error;
  return {
    selectIsFetching,
    selectIsLoading,
    selectError,
  };
};

export const selectApiState = (state) => state[baseApi.reducerPath];