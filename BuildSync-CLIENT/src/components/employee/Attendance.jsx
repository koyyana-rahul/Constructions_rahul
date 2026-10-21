import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { LuCalendarCheck } from "react-icons/lu";
import PageHeader from "../ui/PageHeader";
import StatCard from "../ui/StatCard";
import { Card } from "../ui/Card";
import Toolbar from "../ui/Toolbar";
import ResponsiveList, { MobileCard } from "../ui/ResponsiveList";
import { StatusBadge } from "../ui/Badge";
import { Alert } from "../ui/Feedback";
import EmployeeContextHeader from "./EmployeeContextHeader";
import { useGetAttendanceQuery } from "../../services/api/endpoints/attendanceApi";
import { getErrorMessage } from "../../lib/api";
import { formatDate } from "../../utils/tableUtils";

/** Single-employee attendance columns. The employee is named in the header. */
const columns = [
  {
    name: "#",
    selector: (row) => row.sno,
    width: "64px",
    cell: (row) => (
      <span className="font-display text-xs tabular-nums text-concrete-400">
        {String(row.sno).padStart(2, "0")}
      </span>
    ),
  },
  {
    name: "Date",
    selector: (row) => row.date,
    sortable: true,
    cell: (row) => <span className="tabular-nums">{formatDate(row.date)}</span>,
  },
  {
    name: "Construction Site",
    selector: (row) => row.department,
    cell: (row) => (
      <span className="font-display text-xs font-semibold uppercase tracking-wide text-navy-700">
        {row.department || "—"}
      </span>
    ),
  },
  {
    name: "Status",
    selector: (row) => row.status,
    width: "140px",
    cell: (row) =>
      row.status ? (
        <StatusBadge status={row.status} />
      ) : (
        <StatusBadge tone="neutral">Not marked</StatusBadge>
      ),
  },
];

/**
 * Attendance for one selected employee.
 *
 * The filter is `?employeeId=<Employee._id>`, applied in the Mongo query rather
 * than by filtering in the browser, so this can only ever return this
 * employee's rows.
 */
const EmployeeAttendance = () => {
  const { id } = useParams();
  const [search, setSearch] = useState("");

  // `id` is in the cache key, so Employee A's records and Employee B's records
  // are separate entries and switching employees can never mix them. The
  // filter is applied by the server's Mongo query, not in the browser.
  const { data, error, isLoading, refetch } = useGetAttendanceQuery(
    { employeeId: id },
    { skip: !id }
  );

  const rows = useMemo(
    () =>
      (data ?? []).map((record, index) => ({
        _id: record._id,
        sno: index + 1,
        date: record.date,
        department: record.employeeId?.department?.dep_name,
        name: record.employeeId?.userId?.name,
        status: record.status,
      })),
    [data]
  );

  const counts = useMemo(
    () => ({
      total: rows.length,
      marked: rows.filter((r) => r.status).length,
      present: rows.filter((r) => r.status === "Present").length,
      absent: rows.filter((r) => r.status === "Absent").length,
    }),
    [rows]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((record) =>
      `${record.date || ""} ${record.department || ""} ${record.status || ""}`
        .toLowerCase()
        .includes(term)
    );
  }, [rows, search]);

  return (
    <>
      <PageHeader
        title="Attendance"
        description="Attendance records for this employee, scoped to their own history."
        breadcrumbs={[
          { label: "Admin", to: "/admin-dashboard" },
          { label: "Employees", to: "/admin-dashboard/employees" },
          { label: "Attendance" },
        ]}
      />

      <EmployeeContextHeader active="attendance" />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:mb-5 sm:gap-4 lg:grid-cols-4">
        <StatCard icon={LuCalendarCheck} label="Records" value={counts.total} tone="navy" />
        <StatCard icon={LuCalendarCheck} label="Marked" value={counts.marked} tone="accent" />
        <StatCard icon={LuCalendarCheck} label="Present" value={counts.present} tone="success" />
        <StatCard icon={LuCalendarCheck} label="Absent" value={counts.absent} tone="danger" />
      </div>

      {error && filtered.length > 0 && (
        <Alert variant="warning" className="mb-4 sm:mb-5">
          Showing the last known records. {getErrorMessage(error, "Live data is unavailable.")}
        </Alert>
      )}

      <Card className="overflow-hidden">
        <Toolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by date, site or status"
          searchLabel="Search this employee's attendance"
          actions={
            <p className="font-display text-xs font-semibold uppercase tracking-wider text-concrete-500">
              {filtered.length} of {rows.length}
            </p>
          }
        />

        <ResponsiveList
          columns={columns}
          data={filtered}
          loading={isLoading}
          skeletonRows={8}
          error={error && filtered.length === 0 ? getErrorMessage(error, null) : null}
          onRetry={refetch}
          searchActive={Boolean(search.trim())}
          emptyIcon={LuCalendarCheck}
          emptyTitle={search.trim() ? "No records match your search" : "No attendance yet"}
          emptyDescription={
            search.trim()
              ? "Try a different date, site or status."
              : "Attendance rows appear here once this employee's days have been marked."
          }
          emptyAction={
            search.trim() && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="inline-flex items-center gap-2 rounded-md border border-concrete-300 bg-white px-4 py-2 font-display text-xs font-semibold uppercase tracking-wide text-navy-800 transition-colors hover:border-navy-400 hover:bg-navy-50"
              >
                Clear search
              </button>
            )
          }
          mobileCard={(record) => (
            <MobileCard
              title={formatDate(record.date)}
              subtitle={record.department || undefined}
              status={
                record.status ? (
                  <StatusBadge status={record.status} />
                ) : (
                  <StatusBadge tone="neutral">Not marked</StatusBadge>
                )
              }
            />
          )}
        />
      </Card>
    </>
  );
};

export default EmployeeAttendance;