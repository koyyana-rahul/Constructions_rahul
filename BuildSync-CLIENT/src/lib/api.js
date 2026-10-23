import axios from "axios";

/**
 * Single source of truth for the backend origin and the session.
 *
 * Every endpoint path is unchanged - this only removes the duplicated
 * hardcoded "http://localhost:5000/api/..." strings that were scattered
 * across 49 call sites.
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5050/api";

/**
 * Origin that serves `/public/uploads` (profile images, work-request
 * documents). Derived from the API base URL so a non-default port or a
 * deployed environment never needs a second hardcoded constant.
 */
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

/** Builds an absolute URL for a file the API stored under public/uploads. */
export const assetUrl = (filename) => {
  if (!filename) return undefined;
  // Absolute URLs are stored as-is by some upload paths.
  if (/^https?:\/\//i.test(filename)) return filename;
  return `${API_ORIGIN}/${String(filename).replace(/^\/+/, "")}`;
};

/* ------------------------------------------------------------------ Session */

/**
 * The session token lives in an httpOnly cookie, so JavaScript cannot read
 * it. `localStorage` and `sessionStorage` are both deliberately unused for
 * credentials: anything a script can read, a script can steal.
 *
 * The browser attaches the cookie automatically. All the client has to do is
 * send the request WITH credentials so the browser includes it on a
 * cross-origin call.
 */
export const CSRF_COOKIE = "builtra_csrf";

/**
 * A non-sensitive hint that a session probably exists.
 *
 * The client cannot inspect the httpOnly cookie, so it needs some way to
 * avoid asking the server "who am I?" on every page load for a visitor who
 * is simply signed out. This holds NO credential - it is a boolean the
 * server re-checks with `GET /auth/verify` before anything is trusted.
 */
const SESSION_HINT_KEY = "builtra:session";

export const hasSessionHint = () => {
  try {
    return localStorage.getItem(SESSION_HINT_KEY) === "1";
  } catch {
    return false;
  }
};

export const setSessionHint = () => {
  try {
    localStorage.setItem(SESSION_HINT_KEY, "1");
  } catch {
    /* storage unavailable - the session still works, it just re-verifies */
  }
};

export const clearSessionHint = () => {
  try {
    localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    /* nothing to clear */
  }
};

/** Reads a cookie by name. Only used for the CSRF token, which is readable by design. */
const readCookie = (name) => {
  if (typeof document === "undefined") return null;
  for (const part of document.cookie.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 1) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(eq + 1).trim());
    } catch {
      return part.slice(eq + 1).trim();
    }
  }
  return null;
};

export const getCsrfToken = () => readCookie(CSRF_COOKIE);

/** True when the browser holds what looks like a session. */
export const hasToken = hasSessionHint;

/* ---------------------------------------------------------- Axios client */

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  // REQUIRED: without this the browser refuses to attach the session cookie
  // to a cross-origin request, and every call comes back unauthenticated.
  withCredentials: true,
});

const SAFE_METHODS = new Set(["get", "head", "options"]);

api.interceptors.request.use((config) => {
  const method = (config.method || "get").toLowerCase();

  // Double-submit CSRF token on every state-changing request.
  if (!SAFE_METHODS.has(method)) {
    const csrf = getCsrfToken();
    if (csrf) config.headers["X-CSRF-Token"] = csrf;
  }

  return config;
});

/**
 * Emitted when the session is no longer valid, so the auth slice can sign out.
 *
 * NOTE: 403 (permission denied) is deliberately NOT handled here. A 403 is a
 * server decision about *this* request, not proof that the token is invalid -
 * signing out on it would destroy a perfectly valid session.
 */
export const SESSION_EXPIRED_EVENT = "builtra:session-expired";

export const notifySessionExpired = () => {
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
};

/**
 * Endpoints where a 401 means "those credentials are wrong", not "your session
 * expired". Signing the user out after a mistyped password would destroy a
 * perfectly valid session and bounce them to the login screen for no reason.
 */
const CREDENTIAL_ENDPOINTS = /\/auth\/(login|logout|forgot-password|reset-password|activate|setup-password)/;

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const isCredentialCheck = CREDENTIAL_ENDPOINTS.test(error?.config?.url || "");

    if (status === 401 && !isCredentialCheck) {
      // Expired or revoked session - tell the app to return to a signed-out
      // state instead of looping on failing requests.
      clearSessionHint();
      notifySessionExpired();
    }
    return Promise.reject(error);
  }
);

/* -------------------------------------------------------- Error handling */

/**
 * Reads the response body from either an Axios error or an RTK Query
 * `FetchBaseQueryError`, so the same helper works before and after the
 * migration.
 */
const responseBody = (error) => error?.response?.data ?? error?.data ?? null;

const responseStatus = (error) => error?.response?.status ?? error?.status ?? null;

/**
 * Normalises every failure mode into a plain message string so components
 * never have to repeat `error.response && !error.response.data.success`.
 */
export const getErrorMessage = (
  error,
  fallback = "Something went wrong. Please try again."
) => {
  /**
   * A network failure is checked FIRST, before the response body.
   *
   * "Cannot reach the server" is the only useful message when the request
   * never reached the API, and the body of a transport-level failure carries
   * nothing actionable for the operator.
   */
  const status = responseStatus(error);
  if (status === "FETCH_ERROR" || error?.code === "ERR_NETWORK") {
    return "Cannot reach the server. Check that the API is running.";
  }

  const body = responseBody(error);
  if (body) {
    if (Array.isArray(body.errors) && body.errors.length) {
      return body.errors[0].message;
    }
    if (body.details && Array.isArray(body.details) && body.details.length) {
      return body.details[0].message;
    }
    if (body.error) return body.error;
    if (body.message) return body.message;
  }

  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You do not have permission to perform this action.";
  if (status === 404) return "The requested record could not be found.";

  return fallback;
};

/** Per-field validation errors returned by the API, keyed by field name. */
export const getFieldErrors = (error) => {
  const body = responseBody(error);
  if (!body) return {};
  const list = Array.isArray(body.errors)
    ? body.errors
    : Array.isArray(body.details)
    ? body.details
    : [];
  return list.reduce((acc, item) => {
    if (item?.field) acc[item.field] = item.message;
    return acc;
  }, {});
};

/** Machine-readable business code returned by the API, e.g. INVITATION_PENDING. */
export const getErrorCode = (error) => responseBody(error)?.code ?? null;

/** True when the failure was an authorization decision, not a server fault. */
export const isPermissionError = (error) => responseStatus(error) === 403;

export const isAuthError = (error) => responseStatus(error) === 401;

/** True when the server could not be reached at all. */
export const isNetworkError = (error) =>
  responseStatus(error) === "FETCH_ERROR" || error?.code === "ERR_NETWORK";
