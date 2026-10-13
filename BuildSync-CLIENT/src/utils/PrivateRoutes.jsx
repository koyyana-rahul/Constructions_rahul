import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { PageLoader } from "../components/ui/Feedback";

/** The dashboard a given role is actually allowed into. */
const HOME_FOR_ROLE = {
  admin: "/admin-dashboard",
  employee: "/employee-dashboard",
  client: "/client-dashboard",
};

/**
 * Single route guard: authentication + role authorization.
 *
 * IMPORTANT: React Router renders nested routes through `<Outlet/>`, not
 * `children`. This component must therefore be the `element` of its own route
 * and must render `<Outlet/>` itself - nesting it as `<PrivateRoutes>
 * <RoleBaseRoutes/></PrivateRoutes>` silently discards the inner guard,
 * because the outer component never renders its `children`.
 */
const PrivateRoutes = ({ allowed }) => {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader label="Checking your session" />;

  if (!user) return <Navigate to="/login" replace />;

  if (Array.isArray(allowed) && !allowed.includes(user.role)) {
    return <Navigate to={HOME_FOR_ROLE[user.role] || "/login"} replace />;
  }

  return <Outlet />;
};

export default PrivateRoutes;