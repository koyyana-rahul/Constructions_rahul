import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { LuWallet, LuArrowLeft } from "react-icons/lu";
import PageHeader from "../ui/PageHeader";
import Button from "../ui/Button";
import StatCard from "../ui/StatCard";
import { Card } from "../ui/Card";
import Toolbar from "../ui/Toolbar";
import ResponsiveList, { MobileCard } from "../ui/ResponsiveList";
import { Alert } from "../ui/Feedback";
import { useGetSalaryQuery } from "../../services/api/endpoints/salaryApi";
import { getErrorMessage } from "../../lib/api";
import { useCurrentUser } from "../../features/auth/useSession";
import { formatDate } from "../../utils/tableUtils";
import EmployeeContextHeader, {
  EmployeeCrumb,
} from "../employee/EmployeeContextHeader";
import { formatINR } from "../../utils/format";

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
    name: "Pay date",
    selector: (row) => row.payDate,
    sortable: true,
    cell: (row) => <span className="tabular-nums">{formatDate(row.payDate)}</span>,
  },
  {
    name: "Basic",
    selector: (row) => row.basicSalary,
    cell: (row) => <span className="tabular-nums">{formatINR(row.basicSalary)}</span>,
  },
  {
    name: "Allowances",
    selector: (row) => row.allowances,
    cell: (row) => <span className="tabular-nums text-success-700">+{formatINR(row.allowances)}</span>,
  },
  {
    name: "Deductions",
    selector: (row) => row.deductions,
    cell: (row) => <span className="tabular-nums text-danger-700">−{formatINR(row.deductions)}</span>,
  },
  {
    name: "Net salary",
    selector: (row) => row.netSalary,
    cell: (row) => (
      <span className="font-display font-semibold tabular-nums text-navy-900">
        {formatINR(row.netSalary)}
      </span>
    ),
  },
];

/**
 * Salary slips. Admins see one employee's payroll via
 * `/admin-dashboard/employees/salary/:id`; employees see their own via
 * `/employee-dashboard/salary/:id`. The API resolves payroll from the verified
 * token, so an employee can never read another person's salary.
 */
const ViewSalary = () => {
  const { id } = useParams();
  const user = useCurrentUser();
  const [search, setSearch] = useState("");

  const isEmployeeSelf = user?.role === "employee";
  const role = user?.role ?? "employee";

  /**
   * `{ id, role }` is the cache key. The admin payroll view and the employee's
   * own payroll view therefore occupy different entries, and switching the
   * selected employee swaps the entry rather than refetching the old one.
   *
   * The URL id is a locator only. The backend resolves payroll from the
   * verified token unless the caller is an admin passing `?scope=admin`, so
   * editing the id cannot expose another employee's payslips.
   */
  const { data, error, isLoading, isFetching, refetch } = useGetSalaryQuery(
    { id, role },
    { skip: !id }
  );

  const rows = useMemo(
    () => (data ?? []).map((record, index) => ({ ...record, sno: index + 1 })),
    [data]
  );

  const latest = rows[0];
  const totals = useMemo(
    () => ({ net: rows.reduce((sum, r) => sum + (Number(r.netSalary) || 0), 0) }),
    [rows]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((record) => formatDate(record.payDate).toLowerCase().includes(term));
  }, [rows, search]);

  return (
    <>
      <PageHeader
        title={isEmployeeSelf ? "My Salary Slips" : "Employee Salary Slips"}
        description={
          isEmployeeSelf
            ? "Your payroll history, as recorded by your administrator."
            : "Payroll history recorded for this employee."
        }
        breadcrumbs={
          isEmployeeSelf
            ? [{ label: "My Dashboard", to: "/employee-dashboard" }, { label: "Salary Slips" }]
            : [
                { label: "Admin", to: "/admin-dashboard" },
                { label: "Employees", to: "/admin-dashboard/employees" },
                { label: <EmployeeCrumb id={id} />, to: `/admin-dashboard/employees/${id}` },
                { label: "Salary" },
              ]
        }
        actions={
          <>
            {!isEmployeeSelf && (
              <Link to="/admin-dashboard/employees">
                <Button variant="outline" size="sm">
                  <LuArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Back to employees
                </Button>
              </Link>
            )}
            {isFetching && !isLoading && (
              <span className="hidden text-xs text-concrete-400 sm:inline">Syncing…</span>
            )}
          </>
        }
      />

      {!isEmployeeSelf && <EmployeeContextHeader active="salary" />}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:mb-5 sm:gap-4 lg:grid-cols-4">
        <StatCard
          icon={LuWallet}
          label="Latest net salary"
          value={latest ? formatINR(latest.netSalary) : "—"}
          tone="accent"
        />
        <StatCard
          icon={LuWallet}
          label={`Total recorded (${rows.length} ${rows.length === 1 ? "entry" : "entries"})`}
          value={formatINR(totals.net)}
          tone="navy"
        />
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
          searchPlaceholder="Search by pay date"
          searchLabel="Search salary records"
        />

        <ResponsiveList
          columns={columns}
          data={filtered}
          loading={isLoading}
          error={error && filtered.length === 0 ? getErrorMessage(error, null) : null}
          onRetry={refetch}
          searchActive={Boolean(search.trim())}
          emptyIcon={LuWallet}
          emptyTitle={search.trim() ? "No salary records match" : "No salary records yet"}
          emptyDescription={
            search.trim()
              ? "Try a different pay date."
              : isEmployeeSelf
              ? "Salary entries appear here once your administrator has processed payroll."
              : "Record payroll for this employee to build their salary history."
          }
          emptyAction={
            search.trim() ? (
              <Button variant="outline" size="sm" onClick={() => setSearch("")}>
                Clear search
              </Button>
            ) : !isEmployeeSelf ? (
              <Link to="/admin-dashboard/salary/add">
                <Button variant="accent" size="sm">
                  Record Salary
                </Button>
              </Link>
            ) : null
          }
          mobileCard={(record) => (
            <MobileCard
              title={formatDate(record.payDate)}
              subtitle={`Pay period ending ${formatDate(record.payDate)}`}
              meta={
                <>
                  <span>Basic {formatINR(record.basicSalary)}</span>
                  <span className="text-success-700">+{formatINR(record.allowances)} allowances</span>
                  <span className="text-danger-700">−{formatINR(record.deductions)} deductions</span>
                </>
              }
              actions={
                <span className="font-display text-base font-semibold tabular-nums text-navy-900">
                  {formatINR(record.netSalary)}
                </span>
              }
            />
          )}
        />
      </Card>
    </>
  );
};

export default ViewSalary;