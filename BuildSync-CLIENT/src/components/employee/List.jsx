import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LuHardHat, LuPlus } from "react-icons/lu";
import PageHeader from "../ui/PageHeader";
import Button from "../ui/Button";
import { Card } from "../ui/Card";
import Toolbar from "../ui/Toolbar";
import ResponsiveList, { MobileCard } from "../ui/ResponsiveList";
import { StatusBadge } from "../ui/Badge";
import Avatar from "../ui/Avatar";
import { Alert } from "../ui/Feedback";
import { useGetEmployeesQuery } from "../../services/api/endpoints/employeesApi";
import { getErrorMessage, assetUrl } from "../../lib/api";
import { columns, EmployeeButtons } from "../../utils/EmployeeHelper";

const EmployeeList = () => {
  const [search, setSearch] = useState("");

  const {
    data,
    error,
    isLoading,
    isFetching,
    refetch,
  } = useGetEmployeesQuery({ limit: 100 });

  const employees = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = (data ?? []).map((emp, index) => ({
      _id: emp._id,
      sno: index + 1,
      name: emp.userId?.name,
      employeeId: emp.employeeId,
      dep_name: emp.department?.dep_name,
      designation: emp.designation,
      dob: emp.dob,
      isActive: emp.isActive !== false,
      isActivated: emp.userId?.isActivated !== false,
      profileImage: assetUrl(emp.userId?.profileImage),
      userIdRef: emp.userId?._id,
    }));

    if (!term) return list;
    return list.filter((emp) =>
      `${emp.name || ""} ${emp.employeeId || ""} ${emp.dep_name || ""} ${
        emp.designation || ""
      }`
        .toLowerCase()
        .includes(term)
    );
  }, [data, search]);

  return (
    <>
      <PageHeader
        title="Employees"
        description="Your workforce across all construction sites, with designations and site assignments."
        breadcrumbs={[{ label: "Admin", to: "/admin-dashboard" }, { label: "Employees" }]}
        actions={
          <>
            {isFetching && !isLoading && (
              <span className="hidden text-xs text-concrete-400 sm:inline">Syncing…</span>
            )}
            <Link to="/admin-dashboard/add-employee" className="w-full sm:w-auto">
              <Button variant="accent" className="w-full sm:w-auto">
                <LuPlus className="h-4 w-4" aria-hidden="true" />
                Add Employee
              </Button>
            </Link>
          </>
        }
      />

      {/* Only surface the error when we still have data to show; otherwise
          ResponsiveList renders a full error state. */}
      {error && employees.length > 0 && (
        <Alert variant="warning" className="mb-4 sm:mb-5">
          Showing the last known list. {getErrorMessage(error, "Live data is unavailable.")}
        </Alert>
      )}

      <Card className="overflow-hidden">
        <Toolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by name, ID, site or designation"
          searchLabel="Search employees"
          actions={
            <p className="font-display text-xs font-semibold uppercase tracking-wider text-concrete-500">
              {employees.length} {employees.length === 1 ? "employee" : "employees"}
            </p>
          }
        />

        <ResponsiveList
          columns={columns}
          data={employees}
          loading={isLoading}
          error={error && employees.length === 0 ? getErrorMessage(error, null) : null}
          onRetry={refetch}
          searchActive={Boolean(search.trim())}
          emptyIcon={LuHardHat}
          emptyTitle={search.trim() ? "No employees match your search" : "No employees yet"}
          emptyDescription={
            search.trim()
              ? "Try a different name, employee ID or site."
              : "Add your first employee to assign them to a construction site."
          }
          emptyAction={
            search.trim() ? (
              <Button variant="outline" size="sm" onClick={() => setSearch("")}>
                Clear search
              </Button>
            ) : (
              <Link to="/admin-dashboard/add-employee">
                <Button variant="accent" size="sm">
                  <LuPlus className="h-4 w-4" aria-hidden="true" />
                  Add Employee
                </Button>
              </Link>
            )
          }
          mobileCard={(emp) => (
            <MobileCard
              title={
                <span className="flex items-center gap-2">
                  <Avatar src={emp.profileImage} name={emp.name} size="sm" />
                  <span className="min-w-0 truncate">{emp.name || "Unnamed employee"}</span>
                </span>
              }
              subtitle={
                <>
                  <span className="font-mono">{emp.employeeId}</span>
                  {emp.designation ? ` · ${emp.designation}` : ""}
                </>
              }
              status={
                !emp.isActivated ? (
                  <StatusBadge status="pending">Awaiting setup</StatusBadge>
                ) : emp.isActive ? (
                  <StatusBadge status="active" />
                ) : (
                  <StatusBadge status="inactive" />
                )
              }
              meta={
                <>
                  <span>{emp.dep_name || "Unassigned site"}</span>
                  {emp.dob && <span>DOB {new Date(emp.dob).toLocaleDateString()}</span>}
                </>
              }
              actions={
                <EmployeeButtons
                  Id={emp._id}
                  name={emp.name}
                  userIdRef={emp.userIdRef}
                  isActivated={emp.isActivated}
                />
              }
            />
          )}
        />
      </Card>
    </>
  );
};

export default EmployeeList;