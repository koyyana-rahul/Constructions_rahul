import { createSlice } from "@reduxjs/toolkit";

/**
 * Client-side UI preferences that outlive a single component.
 *
 * Only genuinely shared state belongs here. Form fields, open dialogs and
 * in-progress text stay in React local state - promoting them would mean every
 * keystroke dispatched through the store.
 */

const SIDEBAR_COLLAPSE_KEY = "builtra:sidebar-collapsed";

const readStoredCollapse = () => {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "true";
  } catch {
    return false;
  }
};

const initialState = {
  sidebarCollapsed: readStoredCollapse(),
  mobileNavOpen: false,
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    sidebarToggled(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSE_KEY, String(state.sidebarCollapsed));
      } catch {
        /* storage unavailable - the preference simply is not remembered */
      }
    },
    sidebarCollapseSet(state, action) {
      state.sidebarCollapsed = Boolean(action.payload);
      try {
        localStorage.setItem(SIDEBAR_COLLAPSE_KEY, String(state.sidebarCollapsed));
      } catch {
        /* storage unavailable */
      }
    },
    mobileNavOpened(state) {
      state.mobileNavOpen = true;
    },
    mobileNavClosed(state) {
      state.mobileNavOpen = false;
    },
  },
});

export const {
  sidebarToggled,
  sidebarCollapseSet,
  mobileNavOpened,
  mobileNavClosed,
} = uiSlice.actions;

export const selectSidebarCollapsed = (state) => state.ui.sidebarCollapsed;
export const selectMobileNavOpen = (state) => state.ui.mobileNavOpen;

export default uiSlice.reducer;