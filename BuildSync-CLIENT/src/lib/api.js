import axios from "axios";

/**
 * Single source of truth for the backend origin and the bearer token.
 * Every endpoint path is unchanged - this only removes the duplicated
 * hardcoded "http://localhost:5000/api/..." strings that were scattered
 * across 49 call sites.
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export const getToken = () => localStorage.getItem("token");

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

/** Emitted when the session is no longer valid, so AuthContext can sign out. */
export const SESSION_EXPIRED_EVENT = "buildsync:session-expired";

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;

    if (status === 401) {
      // Expired or revoked token - clear it so the app returns to a clean
      // signed-out state instead of looping on failing requests.
      localStorage.removeItem("token");
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    }

    return Promise.reject(error);
  }
);

/**
 * Normalises every failure mode into a plain message string so components
 * never have to repeat `error.response && !error.response.data.success`.
 */
export const getErrorMessage = (
  error,
  fallback = "Something went wrong. Please try again."
) => {
  const data = error?.response?.data;
  if (data) {
    if (Array.isArray(data.errors) && data.errors.length) {
      return data.errors[0].message;
    }
    if (data.error) return data.error;
    if (data.message) return data.message;
  }
  if (error?.code === "ERR_NETWORK") {
    return "Cannot reach the server. Check that the API is running.";
  }
  return fallback;
};

/** True when the failure was an authorization decision, not a server fault. */
export const isPermissionError = (error) => error?.response?.status === 403;

export const isAuthError = (error) => error?.response?.status === 401;