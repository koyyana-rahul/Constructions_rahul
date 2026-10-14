import { createSelector } from "@reduxjs/toolkit";

/* ---------------------------------------------------------------- Session */

export const selectAuthStatus = (state) => state.auth.status;

export const selectCurrentUser = (state) => state.auth.user;

export const selectUserRole = (state) => state.auth.user?.role ?? null;

/**
 * Home route for a role - the single source of truth for "where does this
 * account belong".
 *
 * Exported as a plain function (not just inside a selector) because the login
 * form must compute the destination from the user it just received, before
 * the store has re-rendered. Deriving it in both places is what keeps the
 * post-login redirect and the 403 recovery from disagreeing.
 */
export const homePathForRole = (role) => {
  if (role === "admin") return "/admin-dashboard";
  if (role === "employee") return "/employee-dashboard";
  if (role === "client") return "/client-dashboard";
  return "/login";
};

/** Same mapping, memoised for components that read it from the store. */
export const selectHomePath = createSelector([selectUserRole], homePathForRole);