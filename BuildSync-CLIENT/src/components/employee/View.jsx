import { Link, useParams } from "react-router-dom";
import {
  LuHardHat,
  LuPencil,
  LuMail,
  LuPhone,
  LuBriefcase,
  LuMapPin,
  LuUser,
} from "react-icons/lu";
import PageHeader from "../ui/PageHeader";
import Button from "../ui/Button";
import { Card, CardHeader, CardBody } from "../ui/Card";
import DetailList, { DetailField } from "../ui/DetailList";
import Avatar from "../ui/Avatar";
import EmployeeContextHeader from "./EmployeeContextHeader";
import { StatusBadge } from "../ui/Badge";
import { Alert, PageLoader } from "../ui/Feedback";
import { useGetEmployeeQuery } from "../../services/api/endpoints/employeesApi";
import { useCurrentUser } from "../../features/auth/useSession";
import { getErrorMessage, assetUrl } from "../../lib/api";
import { formatDate } from "../../utils/tableUtils";
import { formatINR } from "../../utils/format";

/**
 * Employee profile. Serves the admin route (`/admin-dashboard/employees/:id`)
 * and the self-service route (`/employee-dashboard/profile/:id`) - the only
 * difference is which action buttons are shown, because the existing
 * Employee model has no role flag to branch on.
 */
const View = () => {
  const { id } = useParams();
  const currentUser = useCurrentUser();

  /**
   * `id` is an Employee._id on the admin route and a User._id on the
   * self-service route; the API accepts either and resolves the record.
   * The query is skipped until the route actually has an id.
   */
  const {
    data: employee,
    error,
    isLoading: loading,
    refetch,
  } = useGetEmployeeQuery(id, { skip: !id });

  // "Self" means the signed-in employee is looking at their own record. The
  // admin route addresses an Employee._id, so the comparison is against the
  // loaded record's own userId rather than the URL segment.
  const isSelf =
    currentUser?.role === "employee" &&
    String(employee?.userId?._id ?? employee?.userId ?? "") === String(currentUser._id);

  if (loading) return <PageLoader label="Loading employee profile" />;

  if (!employee) {
    return (
      <>
        <PageHeader title="Employee Profile" />
        <Alert variant="error" onDismiss={refetch}>
          {getErrorMessage(error, "Employee record not found.")}
        </Alert>
      </>
    );
  }

  const { userId = {}, department = {} } = employee;
  const avatar = assetUrl(userId.profileImage);

  return (
    <>
      <PageHeader
        title={userId.name || "Employee"}
        description={`${employee.designation || "Team member"} · ${
          department.dep_name || "Unassigned site"
        }`}
        breadcrumbs={[
          ...(isSelf
            ? [{ label: "My Dashboard", to: "/employee-dashboard" }]
            : [
                { label: "Admin", to: "/admin-dashboard" },
                { label: "Employees", to: "/admin-dashboard/employees" },
              ]),
          { label: "Profile" },
        ]}
        actions={
          isSelf ? (
            <Link to="/employee-dashboard/setting">
              <Button variant="outline" size="sm">
                Change Password
              </Button>
            </Link>
          ) : (
            <Link to={`/admin-dashboard/employees/edit/${employee._id}`}>
              <Button variant="accent" size="sm">
                <LuPencil className="h-4 w-4" aria-hidden="true" />
                Edit
              </Button>
            </Link>
          )
        }
      />

      {!isSelf && <EmployeeContextHeader active="profile" showIdentity={false} />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Identity card */}
        <Card className="lg:col-span-1">
          <CardBody className="flex flex-col items-center text-center">
            <Avatar src={avatar} name={userId.name} size="xl" />
            <h2 className="mt-4 font-display text-lg font-semibold uppercase tracking-wide text-navy-900">
              {userId.name}
            </h2>
            <p className="mt-0.5 font-mono text-xs text-concrete-500">{employee.employeeId}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {userId.isActivated === false ? (
                <StatusBadge status="pending">Awaiting setup</StatusBadge>
              ) : (
                <StatusBadge status="active" />
              )}
              <StatusBadge status={employee.maritalStatus || "active"} />
            </div>

            <div className="mt-5 w-full space-y-2.5 border-t border-concrete-100 pt-5 text-left">
              <p className="flex items-center gap-2 text-sm text-concrete-600">
                <LuBriefcase className="h-4 w-4 shrink-0 text-concrete-400" aria-hidden="true" />
                {employee.designation || "—"}
              </p>
              <p className="flex items-center gap-2 text-sm text-concrete-600">
                <LuMapPin className="h-4 w-4 shrink-0 text-concrete-400" aria-hidden="true" />
                {department.dep_name || "Unassigned site"}
              </p>
              {userId.email && (
                <p className="flex items-center gap-2 break-all text-sm text-concrete-600">
                  <LuMail className="h-4 w-4 shrink-0 text-concrete-400" aria-hidden="true" />
                  {userId.email}
                </p>
              )}
              {userId.phone && (
                <p className="flex items-center gap-2 text-sm text-concrete-600">
                  <LuPhone className="h-4 w-4 shrink-0 text-concrete-400" aria-hidden="true" />
                  {userId.phone}
                </p>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Employment details */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Employment Details"
            actions={
              <span className="font-display text-2xs font-semibold uppercase tracking-wider text-concrete-400">
                <LuHardHat className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
                Workforce record
              </span>
            }
          />
          <CardBody>
            <DetailList>
              <DetailField label="Employee ID" value={employee.employeeId} />
              <DetailField label="Full name" value={userId.name} />
              <DetailField label="Email" value={userId.email} />
              <DetailField label="Phone" value={userId.phone} />
              <DetailField label="Designation" value={employee.designation} />
              <DetailField label="Construction site" value={department.dep_name} />
              <DetailField label="Date of birth" value={formatDate(employee.dob)} />
              <DetailField label="Gender" value={employee.gender} />
              <DetailField label="Marital status" value={employee.maritalStatus} />
              <DetailField
                label="Monthly salary"
                value={employee.salary ? formatINR(employee.salary) : null}
              />
            </DetailList>
          </CardBody>
        </Card>
      </div>

      {!isSelf && (
        <p className="mt-5 flex items-center gap-2 text-xs text-concrete-500">
          <LuUser className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Salary and leave are managed from the admin workspace.
        </p>
      )}
    </>
  );
};

export default View;