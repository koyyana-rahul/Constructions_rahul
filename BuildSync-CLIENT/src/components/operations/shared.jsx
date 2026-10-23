import { useMemo } from "react";
import { useCurrentUser } from "../../features/auth/useSession";
import { useGetProjectsQuery } from "../../services/api/endpoints/projectsApi";
import { useGetDepartmentsQuery } from "../../services/api/endpoints/departmentsApi";
import { useGetEmployeesQuery } from "../../services/api/endpoints/employeesApi";
import { useGetClientsQuery } from "../../services/api/endpoints/clientsApi";
import { useGetVendorsQuery } from "../../services/api/endpoints/commercialApi";

/** Date helpers shared by every operations screen. */
export const dateInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

export const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
};

export const daysUntil = (value) => {
  if (!value) return null;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((target.getTime() - Date.now()) / 86400000);
};

/**
 * Options for the selects used across the operations forms.
 *
 * Admin-only reference lists are skipped for other roles: the server would
 * answer 403, and a field engineer only needs the projects they can already
 * see. `skip` keeps RTK Query from issuing those requests at all.
 */
export const useOperationReference = ({
  projects = true,
  sites = false,
  employees = false,
  clients = false,
  vendors = false,
} = {}) => {
  const user = useCurrentUser();
  const admin = user?.role === "admin";

  const projectQuery = useGetProjectsQuery(
    { limit: 200, includeArchived: false },
    { skip: !projects }
  );
  const siteQuery = useGetDepartmentsQuery(undefined, { skip: !sites || !admin });
  const employeeQuery = useGetEmployeesQuery({ limit: 200 }, { skip: !employees || !admin });
  const clientQuery = useGetClientsQuery({ limit: 200 }, { skip: !clients || !admin });
  const vendorQuery = useGetVendorsQuery({ limit: 200 }, { skip: !vendors || !admin });

  return useMemo(
    () => ({
      user,
      admin,
      projects: projectQuery.data?.projects ?? [],
      sites: siteQuery.data ?? [],
      employees: employeeQuery.data ?? [],
      clients: clientQuery.data ?? [],
      vendors: vendorQuery.data?.vendors ?? [],
      loading:
        (projects && projectQuery.isLoading) ||
        (sites && admin && siteQuery.isLoading) ||
        (employees && admin && employeeQuery.isLoading) ||
        (clients && admin && clientQuery.isLoading) ||
        (vendors && admin && vendorQuery.isLoading),
    }),
    [
      user,
      admin,
      projects,
      projectQuery.data,
      projectQuery.isLoading,
      sites,
      siteQuery.data,
      siteQuery.isLoading,
      employees,
      employeeQuery.data,
      employeeQuery.isLoading,
      clients,
      clientQuery.data,
      clientQuery.isLoading,
      vendors,
      vendorQuery.data,
      vendorQuery.isLoading,
    ]
  );
};

/** Human label for an employee reference. */
export const employeeName = (employee) =>
  employee?.userId?.name || employee?.name || employee?.employeeId || "Unassigned";

export const projectName = (project) =>
  project?.name || project?.code || "Unassigned project";

export const clientName = (client) =>
  client?.companyName || client?.userId?.name || client?.name || "—";
