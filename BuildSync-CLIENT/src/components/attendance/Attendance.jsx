import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  LuCalendarCheck,
  LuFileBarChart,
  LuSearch,
  LuCheckCircle2,
  LuUserX,
} from "react-icons/lu";
import PageHeader from "../ui/PageHeader";
import Button from "../ui/Button";
import StatCard from "../ui/StatCard";
import { Card } from "../ui/Card";
import Toolbar from "../ui/Toolbar";
import ResponsiveList, { MobileCard } from "../ui/ResponsiveList";
import { StatusBadge } from "../ui/Badge";
import { Alert } from "../ui/Feedback";
import { useQuery } from "../../hooks/useQuery";
import { api, getErrorMessage } from "../../lib/api";
import { columns, AttendanceHelper } from "../../utils/AttendanceHelper";
import { formatDate } from "../../utils/tableUtils";

const Attendance = () => {
  const [search, setSearch] = useState("");
  const today = formatDate(new Date());

  // The default-attendance middleware is idempotent, so polling is safe.
  const { data, error, isLoading, isRefreshing, refetch } = useQuery(
    ["attendance"],
    async () => {
      const { data: res } = await api.get("/attendance");
      return res.success ? res.attendance || [] : [];
    },
    { staleTime: 10_000, poll: 30_000 }
  );

  const rows = useMemo(
    () =>
      (data ?? []).map((record, index) => ({
        employeeId: record.employeeId?.employeeId,
        sno: index + 1,
        department: record.employeeId?.department?.dep_name,
        name: record.employeeId?.userId?.name,
        status: record.status,
        employeeRef: record.employeeId?.employeeId,
      })),
    [data]
  );

  const counts = useMemo(
    () => ({
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
      `${record.name || ""} ${record.employeeId || ""} ${record.department || ""}`
        .toLowerCase()
        .includes(term)
    );
  }, [rows, search]);

  return (
    <>
      <PageHeader
        title="Daily Attendance"
        description={`Mark attendance for ${today} across every construction site.`}
        breadcrumbs={[{ label: "Admin", to: "/admin-dashboard" }, { label: "Attendance" }]}
        actions={
          <>
            {isRefreshing && (
              <span className="hidden text-xs text-concrete-400 sm:inline">Syncing…</span>
            )}
            <Link to="/admin-dashboard/attendance-report" className="w-full sm:w-auto">
              <Button variant="accent" className="w-full sm:w-auto">
                <LuFileBarChart className="h-4 w-4" aria-hidden="true" />
                Attendance Report
              </Button>
            </Link>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 sm:mb-5 lg:grid-cols-4">
        <StatCard icon={LuCalendarCheck} label="Total Employees" value={rows.length} tone="navy" />
        <StatCard icon={LuSearch} label="Marked Today" value={counts.marked} tone="accent" />
        <StatCard icon={LuCheckCircle2} label="Present" value={counts.present} tone="success" />
        <StatCard icon={LuUserX} label="Absent" value={counts.absent} tone="danger" />
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
          searchPlaceholder="Search by employee, ID or site"
          searchLabel="Search attendance"
          actions={
            <p className="font-display text-xs font-semibold uppercase tracking-wider text-concrete-500">
              {filtered.length} of {rows.length}
            </p>
          }
        />

        <ResponsiveList
          columns={columns}
          data={filtered.map((record) => ({
            ...record,
            action: (
              <AttendanceHelper
                status={record.status}
                employeeId={record.employeeRef}
                statusChange={refetch}
              />
            ),
          }))}
          loading={isLoading}
          skeletonRows={10}
          error={error && filtered.length === 0 ? getErrorMessage(error, null) : null}
          onRetry={refetch}
          searchActive={Boolean(search.trim())}
          paginationPerPage={15}
          emptyIcon={LuCalendarCheck}
          emptyTitle={search.trim() ? "No employees match your search" : "No employees to mark"}
          emptyDescription={
            search.trim()
              ? "Try a different name, employee ID or site."
              : "Add employees to a construction site to begin marking attendance."
          }
          emptyAction={
            search.trim() && (
              <Button variant="outline" size="sm" onClick={() => setSearch("")}>
                Clear search
              </Button>
            )
          }
          mobileCard={(record) => (
            <MobileCard
              title={record.name || "Employee"}
              subtitle={
                <>
                  <span className="font-mono">{record.employeeId}</span>
                  {record.department ? ` · ${record.department}` : ""}
                </>
              }
              status={
                record.status ? (
                  <StatusBadge status={record.status} />
                ) : (
                  <StatusBadge tone="neutral">Not marked</StatusBadge>
                )
              }
              actions={
                <AttendanceHelper
                  status={record.status}
                  employeeId={record.employeeRef}
                  statusChange={refetch}
                />
              }
            />
          )}
        />
      </Card>
    </>
  );
};

export default Attendance;