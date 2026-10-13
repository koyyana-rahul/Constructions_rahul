import { Link, useParams } from "react-router-dom";
import { LuArrowLeft, LuHardHat } from "react-icons/lu";
import Avatar from "../ui/Avatar";
import { StatusBadge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { Alert, Skeleton } from "../ui/Feedback";
import useEmployee from "../../hooks/useEmployee";
import { getErrorMessage, isPermissionError } from "../../lib/api";

const EMPLOYEE_IMAGE_URL = (filename) =>
  filename ? `http://localhost:5000/${filename}` : undefined;

/**
 * Section tabs. The employee id is part of every href, so switching sections
 * preserves context and a refresh or a pasted link lands on the same person.
 */
export const EmployeeSectionTabs = ({ employeeId, active }) => (
  <nav
    aria-label="Employee sections"
    className="border-t border-concrete-200 bg-concrete-50 px-2 py-1.5"
  >
    <ul className="-mx-1 flex flex-wrap items-center gap-1">
      {[
        { key: "profile", label: "Profile", to: `/admin-dashboard/employees/${employeeId}` },
        {
          key: "leave",
          label: "Leave Requests",
          to: `/admin-dashboard/employees/leaves/${employeeId}`,
        },
        {
          key: "salary",
          label: "Salary",
          to: `/admin-dashboard/employees/salary/${employeeId}`,
        },
        {
          key: "attendance",
          label: "Attendance",
          to: `/admin-dashboard/employees/attendance/${employeeId}`,
        },
      ].map((section) => {
        const isActive = section.key === active;
        return (
          <li key={section.key}>
            <Link
              to={section.to}
              aria-current={isActive ? "page" : undefined}
              className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 font-display text-xs font-semibold uppercase tracking-wide transition-colors ${
                isActive
                  ? "bg-navy-900 text-white shadow-card"
                  : "text-concrete-600 hover:bg-white hover:text-navy-800"
              }`}
            >
              {!isActive && <LuHardHat className="h-3.5 w-3.5" aria-hidden="true" />}
              {section.label}
            </Link>
          </li>
        );
      })}
    </ul>
  </nav>
);

/**
 * Breadcrumb segment showing the selected employee's name.
 *
 * Reads the same `["employee", id]` cache entry as the header, so the name in
 * the trail and the identity block cannot disagree, and the shared entry is
 * fetched once. Returns a plain node so it can be used as a PageHeader crumb
 * label.
 */
export const EmployeeCrumb = ({ id }) => {
  const { data } = useEmployee(id);
  return <>{data?.userId?.name || "Employee"}</>;
};

/**
 * Shared employee identity header for every admin employee-scoped page.
 *
 * A component rather than four hand-rolled headers because the employee must be
 * unmistakable on Leave, Salary, Attendance and Profile, and the tabs have to
 * carry the selected employee in the URL so a refresh restores context.
 *
 * The employee is fetched by `Employee._id` - the same identifier the leave,
 * salary and attendance endpoints use - so the header and the records beneath
 * it are guaranteed to describe the same person.
 *
 * `showIdentity={false}` renders only the section tabs, for the profile page
 * which already displays the complete identity block itself.
 */
const EmployeeContextHeader = ({ active = "profile", showIdentity = true, children }) => {
  const { id } = useParams();

  // Shared cache entry: the breadcrumb rendered above this header reads the
  // same record without issuing a second request.
  const { data: employee, error, isLoading } = useEmployee(id);

  // Profile page owns its own loading/error handling.
  if (!showIdentity && (isLoading || !employee)) return null;

  if (isLoading) {
    return (
      <Card className="mb-4 sm:mb-5">
        <div className="flex flex-wrap items-center gap-4 p-4 sm:p-5">
          <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      </Card>
    );
  }

  if (isPermissionError(error)) {
    return (
      <Alert variant="error" className="mb-4 sm:mb-5">
        You do not have permission to view this employee.
      </Alert>
    );
  }

  if (!employee) {
    return (
      <>
        <Card className="mb-4 sm:mb-5">
          <Alert variant="error">
            {getErrorMessage(error, "This employee could not be found.")} The record may have
            been deleted.
          </Alert>
        </Card>
        <Link
          to="/admin-dashboard/employees"
          className="inline-flex items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-wide text-accent-600 hover:text-accent-700"
        >
          <LuArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to employees
        </Link>
      </>
    );
  }

  const user = employee.userId ?? {};
  const name = user.name || "Employee";

  // Only fields that actually exist are rendered - nothing is invented.
  const meta = [
    employee.designation,
    employee.department?.dep_name,
    user.email,
    employee.phone,
  ].filter(Boolean);

  return (
    <Card className="mb-4 overflow-hidden sm:mb-5">
      {showIdentity && (
        <div className="flex flex-wrap items-start gap-x-4 gap-y-3 p-4 sm:p-5">
          <Avatar src={EMPLOYEE_IMAGE_URL(user.profileImage)} name={name} size="lg" />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
              <h2 className="min-w-0 font-display text-xl font-semibold leading-tight tracking-wide text-navy-900 break-words sm:text-2xl">
                {name}
              </h2>
              <StatusBadge status={employee.isActive === false ? "Inactive" : "Active"} />
            </div>

            {employee.employeeId && (
              <p className="mt-1 font-mono text-xs text-navy-600">{employee.employeeId}</p>
            )}

            {meta.length > 0 && (
              <ul className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-concrete-600">
                {meta.map((item, index) => (
                  <li key={`${item}-${index}`} className="flex items-center gap-2">
                    {index > 0 && (
                      <span className="text-concrete-300" aria-hidden="true">
                        ·
                      </span>
                    )}
                    <span className="break-words">{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Link
            to="/admin-dashboard/employees"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-concrete-300 bg-white px-3 py-2 font-display text-xs font-semibold uppercase tracking-wide text-navy-800 transition-colors hover:border-navy-400 hover:bg-navy-50"
          >
            <LuArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Employees
          </Link>
        </div>
      )}

      <EmployeeSectionTabs employeeId={id} active={active} />
      {children}
    </Card>
  );
};

export default EmployeeContextHeader;