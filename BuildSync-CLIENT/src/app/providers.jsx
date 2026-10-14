import { Provider } from "react-redux";
import { store } from "./store";
import SessionWatcher from "./SessionWatcher";

/**
 * Application providers.
 *
 * The Redux Provider replaces the old `AuthProvider`; `SessionWatcher` (rendered
 * inside the store) does what the context provider used to do.
 */
export const AppProviders = ({ children }) => (
  <Provider store={store}>
    <SessionWatcher />
    {children}
  </Provider>
);

export default AppProviders;