import { useEffect, useRef } from "react";
import { useAppDispatch } from "./hooks";
import { useVerifySessionQuery } from "../services/api/endpoints/authApi";
import { sessionAuthenticated, sessionAnonymous, sessionCleared } from "../features/auth/authSlice";
import { baseApi } from "../services/api/baseApi";
import { hasToken, SESSION_EXPIRED_EVENT } from "../lib/api";

/**
 * Session bootstrap.
 *
 * Owns exactly three responsibilities, all of which used to live in
 * `AuthContext`:
 *
 *   1. On first load, ask `/auth/verify` whether the stored token is still
 *      valid and mirror the answer into the auth slice. Until that settles,
 *      `status` is "unknown" and every route guard renders a loader - which is
 *      what stops a deep link from bouncing to /login before the session has
 *      been restored.
 *   2. Listen for the Axios client's session-expired event (raised on any 401)
 *      and drop the session in one place, so a half-authenticated UI can never
 *      appear.
 *   3. Purge the RTK Query cache when the session ends, so records fetched by
 *      a previous account are not visible to the next one.
 */
const SessionWatcher = () => {
  const dispatch = useAppDispatch();
  const hadToken = useRef(hasToken());

  const {
    data: user,
    isError,
    isSuccess,
  } = useVerifySessionQuery(undefined, { skip: !hadToken.current });

  // Expired or revoked token seen anywhere in the app.
  useEffect(() => {
    const onExpired = () => {
      hadToken.current = false;
      dispatch(sessionCleared());
      dispatch(baseApi.util.resetApiState());
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [dispatch]);

  // No token at all: definitively signed out, no request needed.
  useEffect(() => {
    if (!hadToken.current) dispatch(sessionAnonymous());
  }, [dispatch]);

  // Token verified.
  useEffect(() => {
    if (isSuccess) dispatch(sessionAuthenticated(user));
  }, [isSuccess, user, dispatch]);

  // Token present but rejected / unreachable - treat as signed out rather than
  // leaving the guard spinning forever.
  useEffect(() => {
    if (isError) {
      hadToken.current = false;
      dispatch(sessionCleared());
    }
  }, [isError, dispatch]);

  return null;
};

export default SessionWatcher;