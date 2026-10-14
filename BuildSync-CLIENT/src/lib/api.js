import axios from "axios";

/**
 * Single source of truth for the backend origin and the bearer token.
 *
 * Every endpoint path is unchanged - this only removes the duplicated
 * hardcoded "http://localhost:5000/api/..." strings that were scattered
 * across 49 call sites.
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

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

/* ------------------------------------------------------------------ Token */

export const TOKEN_KEY = "buildsync:token";

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? localStorage.getItem("token");
  } catch {
    return null;
  }
};

/**
 * The legacy `token` key is what the previous AuthContext read. Both are
 * written on sign-in so a stale key can never point at a cleared session.
 */
export const setToken = (token) => {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem("token", token);
  } catch {
    /* storage unavailable - the session simply will not survive a refresh */
  }
};

export const clearToken = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("token");
  } catch {
    /* nothing to clear */
  }
};

export const hasToken = () => Boolean(getToken());

/* ---------------------------------------------------------- Axios client */

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
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
export const SESSION_EXPIRED_EVENT = "buildsync:session-expired";

export const notifySessionExpired = () => {
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
};

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      // Expired or revoked token - clear it so the app returns to a clean
      // signed-out state instead of looping on failing requests.
      clearToken();
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

  const status = responseStatus(error);
  if (status === "FETCH_ERROR" || error?.code === "ERR_NETWORK") {
    return "Cannot reach the server. Check that the API is running.";
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