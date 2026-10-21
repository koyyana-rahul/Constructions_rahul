import { createSlice } from "@reduxjs/toolkit";
import { clearSessionHint } from "../../lib/api";

/**
 * Authenticated session state - the single source of truth for "who is signed
 * in".
 *
 * The previous `AuthContext` held the same information in React state. Keeping
 * both would give the app two competing answers, so the context is gone and
 * every consumer reads this slice.
 *
 * The JWT itself is deliberately NOT in Redux and NOT in localStorage. It lives in
 * an httpOnly cookie that JavaScript cannot read, so no injected script can
 * exfiltrate it. The slice only records WHO is signed in.
 *
 * `status` matters for route guards:
 *   - "unknown"     -> we have not asked the server yet; render nothing
 *                      protected, or the guard flashes a redirect to /login
 *                      before the session has been restored.
 *   - "authenticated"
 *   - "anonymous"    -> definitively signed out; safe to redirect.
 */
const initialState = {
  user: null,
  status: "unknown",
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    /** The token exists but has not been verified against /auth/verify yet. */
    sessionPending(state) {
      if (state.status !== "authenticated") state.status = "unknown";
    },
    sessionAuthenticated(state, action) {
      state.user = action.payload ?? null;
      state.status = action.payload ? "authenticated" : "anonymous";
    },
    sessionAnonymous(state) {
      state.user = null;
      state.status = "anonymous";
    },
    /** Clears the slice and the stored token. Used by sign-out and by a 401. */
    sessionCleared(state) {
      clearSessionHint();
      state.user = null;
      state.status = "anonymous";
    },
  },
});

export const { sessionPending, sessionAuthenticated, sessionAnonymous, sessionCleared } =
  authSlice.actions;

export default authSlice.reducer;