import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { baseApi } from "../services/api/baseApi";
import authReducer from "../features/auth/authSlice";
import uiReducer from "../features/ui/uiSlice";

/**
 * The single application store.
 *
 * Slices registered here hold ONLY client-side state that several components
 * must agree on (who is signed in, sidebar and filter preferences). Every
 * server-managed record lives in the RTK Query cache instead, so no response is
 * ever stored twice.
 */
export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    auth: authReducer,
    ui: uiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Upload mutations carry FormData/File in their `arg`; those are
        // request arguments, not application state.
        ignoredActionPaths: ["payload.arg", "meta.arg"],
        ignoredPaths: [`${baseApi.reducerPath}.mutations`],
      },
    }).concat(baseApi.middleware),
  devTools: import.meta.env.DEV,
});

// Enables refetchOnReconnect / refetchOnFocus for RTK Query.
setupListeners(store.dispatch);

export default store;