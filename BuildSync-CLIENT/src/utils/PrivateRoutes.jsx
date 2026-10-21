import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAppSelector } from "../app/hooks";
import { selectCurrentUser, selectHomePath, selectAuthStatus } from "../features/auth/authSelectors";
import { PageLoader } from "../components/ui/Feedback";

/**
 * Single route guard: authentication + role authorization.
 *
 * IMPORTANT: React Router renders nested routes through `<Outlet/>`, not
 * `children`. This component must therefore be the `element` of its own route
 * and must render `<Outlet/>` itself - nesting it as `<PrivateRoutes>
 * <RoleBaseRoutes/></PrivateRoutes>` silently discards the inner guard,
 * because the outer component never renders its `children`.
 *
 * Three states are handled explicitly:
 *   - "unknown"     the stored token has not been verified yet. Render a
 *                   loader. Redirecting here would send a signed-in user who
 *                   opened a deep link or refreshed the page to /login.
 *   - no user       redirect to /login, remembering where they were going so a
 *                   successful sign-in can return them there.
 *   - wrong role    redirect to that role's own dashboard - never back to the
 *                   page they were denied, which would loop.
 *
 * This improves UX only. Every endpoint behind these routes enforces the same
 * permissions server-side.
 */
const PrivateRoutes = ({ allowed }) => {
  const user = useAppSelector(selectCurrentUser);
  const status = useAppSelector(selectAuthStatus);
  const homePath = useAppSelector(selectHomePath);
  const location = useLocation();

  if (status === "unknown") return <PageLoader label="Checking your session" />;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (Array.isArray(allowed) && !allowed.includes(user.role)) {
    return <Navigate to={homePath} replace />;
  }

  return <Outlet />;
};

export default PrivateRoutes;