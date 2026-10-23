import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  LuActivity,
  LuArrowRight,
  LuCalendarDays,
  LuDownload,
  LuFileBarChart,
  LuFolderKanban,
  LuHardHat,
  LuPackage,
  LuRefreshCw,
  LuShieldCheck,
  LuWallet,
} from "react-icons/lu";
import PageHeader from "../../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import StatCard from "../../components/ui/StatCard";
import Button from "../../components/ui/Button";
import Badge, { StatusBadge } from "../../components/ui/Badge";
import ProgressBar from "../../components/ui/ProgressBar";
import { Alert, CardSkeleton, EmptyState, PermissionDenied } from "../../components/ui/Feedback";
import { FilterChips } from "../../components/ui/Toolbar";
import { Input } from "../../components/ui/Form";
import { getErrorMessage, isPermissionError } from "../../lib/api";
import { downloadExport } from "../../lib/download";
import { useCurrentUser } from "../../features/auth/useSession";
import { useAppSelector } from "../../app/hooks";
import { selectHomePath } from "../../features/auth/authSelectors";
import { formatINR, formatINRCompact } from "../../utils/format";
import {
  useGetFieldReportQuery,
  useGetFinanceReportQuery,
  useGetInventoryReportQuery,
  useGetProjectReportQuery,
  useGetReportOverviewQuery,
  useGetSafetyReportQuery,
} from "../../services/api/endpoints/platformApi";
import { formatDate, dateInput } from "./shared";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "projects", label: "Projects" },
  { value: "finance", label: "Finance" },
  { value: "inventory", label: "Inventory" },
  { value: "safety", label: "Safety" },
  { value: "field", label: "Field" },
];

const EXPORT_TYPES = {
  overview: [
    { type: "projects", label: "Projects CSV" },
    { type: "invoices", label: "Invoices CSV" },
  ],
  projects: [{ type: "projects", label: "Projects CSV" }],
  finance: [
    { type: "invoices", label: "Invoices CSV" },
    { type: "expenses", label: "Expenses CSV" },
  ],
  inventory: [{ type: "stock", label: "Stock CSV" }],
  safety: [{ type: "safety", label: "Safety CSV" }],
  field: [
    { type: "tasks", label: "Tasks CSV" },
    { type: "employees", label: "Employees CSV" },
  ],
};

const monthLabel = (value) => {
  if (!value) return "—";
  const [year, month] = String(value).split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
};

const number = (value) => new Intl.NumberFormat("en-IN").format(Number(value) || 0);

const ReportError = ({ query }) => (
  <Card>
    <CardBody>
      <Alert variant="error">{getErrorMessage(query.error)}</Alert>
    </CardBody>
  </Card>
);

const ReportLoading = ({ label }) => (
  <Card>
    <CardBody>
      <p className="py-8 text-center text-sm text-concrete-500">Loading {label}…</p>
    </CardBody>
  </Card>
);

/** Lightweight horizontal bar used in the finance and safety trend blocks. */
const TrendBars = ({ rows, series }) => {
  const max = Math.max(
    1,
    ...rows.flatMap((row) => series.map((entry) => Number(row[entry.key]) || 0))
  );

  if (!rows.length) {
    return <p className="py-8 text-center text-sm text-concrete-500">No activity in this period.</p>;
  }

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <div key={row.month}>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="font-display text-xs font-semibold uppercase tracking-wide text-concrete-500">
              {monthLabel(row.month)}
            </p>
            <p className="text-xs text-concrete-500">
              {series
                .map((entry) => `${entry.label} ${formatINRCompact(row[entry.key])}`)
                .join(" · ")}
            </p>
          </div>
          <div className="space-y-1">
            {series.map((entry) => {
              const value = Number(row[entry.key]) || 0;
              return (
                <div key={entry.key} className="flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-concrete-100">
                    <div
                      className={`h-full rounded-full ${entry.className}`}
                      style={{ width: `${Math.max(value ? 3 : 0, (value / max) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

const OverviewCard = ({ title, description, children, action }) => (
  <Card>
    <CardHeader title={title} description={description} actions={action} />
    <CardBody>{children}</CardBody>
  </Card>
);

const AdminOverview = ({ data, basePath }) => {
  const overview = data;
  if (!overview) return null;

  const finance = overview.finance || {};
  const projects = overview.projects || {};
  const tasks = overview.tasks || {};
  const workforce = overview.workforce || {};
  const safety = overview.safety || {};
  const inventory = overview.inventory || {};
  const equipment = overview.equipment || {};
  const approvals = overview.approvals || {};

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          icon={LuFolderKanban}
          label="Active projects"
          value={projects.active ?? 0}
          hint={`${projects.delayed ?? 0} behind schedule`}
          tone={projects.delayed ? "warning" : "navy"}
        />
        <StatCard
          icon={LuWallet}
          label="Outstanding"
          value={formatINRCompact(finance.outstanding)}
          hint={`${formatINRCompact(finance.overdue?.amount)} overdue`}
          tone={finance.overdue?.amount ? "danger" : "success"}
        />
        <StatCard
          icon={LuActivity}
          label="Cost to date"
          value={formatINRCompact(finance.costToDate)}
          hint={`Collected ${formatINRCompact(finance.collected)}`}
          tone="accent"
        />
        <StatCard
          icon={LuFileBarChart}
          label="Open tasks"
          value={tasks.open ?? 0}
          hint={`${tasks.overdue ?? 0} overdue · ${tasks.blocked ?? 0} blocked`}
          tone={tasks.overdue ? "warning" : "navy"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <OverviewCard
          title="Commercial position"
          description="Billed, collected and costed work across the portfolio."
          action={
            <Link
              to={`${basePath}/invoices`}
              className="inline-flex items-center gap-1 font-display text-xs font-semibold uppercase tracking-wide text-accent-600 hover:text-accent-700"
            >
              Invoices <LuArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          }
        >
          <dl className="space-y-3 text-sm">
            {[
              ["Contract value", projects.contractValue],
              ["Billed", finance.billed],
              ["Collected", finance.collected],
              ["Outstanding", finance.outstanding],
              ["Approved cost", finance.costToDate],
              ["Gross margin (cash)", finance.grossMarginCollected],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 border-b border-concrete-100 pb-2.5 last:border-0 last:pb-0">
                <dt className="text-concrete-500">{label}</dt>
                <dd className="font-display font-semibold tabular-nums text-navy-900">
                  {formatINR(value)}
                </dd>
              </div>
            ))}
          </dl>
        </OverviewCard>

        <OverviewCard
          title="Field operations"
          description="Workforce, safety and plant readiness today."
          action={
            <Link
              to={`${basePath}/daily-reports`}
              className="inline-flex items-center gap-1 font-display text-xs font-semibold uppercase tracking-wide text-accent-600 hover:text-accent-700"
            >
              Site reports <LuArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          }
        >
          <dl className="space-y-3 text-sm">
            {[
              ["Present today", `${number(workforce.presentToday)} / ${number(workforce.markedToday)} marked`],
              ["Attendance rate", `${workforce.attendanceRate ?? 0}%`],
              ["Open safety incidents", `${safety.openIncidents ?? 0} (${safety.criticalOpen ?? 0} critical)`],
              ["Low-stock lines", number(inventory.lowStockCount)],
              ["Equipment utilisation", `${equipment.utilization ?? 0}%`],
              ["Pending approvals", number(approvals.total)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 border-b border-concrete-100 pb-2.5 last:border-0 last:pb-0">
                <dt className="text-concrete-500">{label}</dt>
                <dd className="font-display font-semibold tabular-nums text-navy-900">{value}</dd>
              </div>
            ))}
          </dl>
        </OverviewCard>

        <OverviewCard
          title="Deadlines ahead"
          description="Projects and tasks due in the next two weeks."
        >
          <div className="space-y-3">
            {(overview.upcoming?.projectDeadlines ?? []).length === 0 &&
            (overview.upcoming?.taskDeadlines ?? []).length === 0 ? (
              <p className="text-sm text-concrete-500">Nothing due in the next two weeks.</p>
            ) : (
              <>
                {(overview.upcoming?.projectDeadlines ?? []).map((project) => (
                  <Link
                    key={project._id}
                    to={`${basePath}/projects/${project._id}`}
                    className="block rounded-md border border-concrete-200 px-3 py-2.5 transition-colors hover:border-navy-300 hover:bg-navy-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate font-display text-sm font-semibold text-navy-900">
                        {project.code} · {project.name}
                      </p>
                      <StatusBadge status={project.status} />
                    </div>
                    <p className="mt-1 text-xs text-concrete-500">
                      Due {formatDate(project.endDate)} · {project.progress ?? 0}% complete
                    </p>
                  </Link>
                ))}
                {(overview.upcoming?.taskDeadlines ?? []).slice(0, 3).map((task) => (
                  <div
                    key={task._id}
                    className="rounded-md border border-concrete-200 px-3 py-2.5"
                  >
                    <p className="truncate font-display text-sm font-medium text-navy-900">
                      {task.title}
                    </p>
                    <p className="mt-1 text-xs text-concrete-500">
                      {task.project?.code || "Project"} · due {formatDate(task.dueDate)} ·{" "}
                      {task.priority}
                    </p>
                  </div>
                ))}
              </>
            )}
          </div>
        </OverviewCard>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard icon={LuHardHat} label="Active workforce" value={workforce.activeEmployees ?? 0} hint={`${workforce.sites ?? 0} sites`} tone="navy" />
        <StatCard icon={LuShieldCheck} label="Safety this month" value={safety.thisMonth ?? 0} hint={`${safety.openIncidents ?? 0} still open`} tone={safety.criticalOpen ? "danger" : "success"} />
        <StatCard icon={LuPackage} label="Low stock" value={inventory.lowStockCount ?? 0} hint="Lines at or below reorder" tone={inventory.lowStockCount ? "warning" : "success"} />
        <StatCard icon={LuActivity} label="Equipment in use" value={equipment.inUse ?? 0} hint={`${equipment.utilization ?? 0}% utilisation`} tone="accent" />
      </div>
    </div>
  );
};

const ClientOverview = ({ data, basePath }) => {
  if (!data) return null;
  const projects = data.projects || {};
  const finance = data.finance || {};

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard icon={LuFolderKanban} label="Projects" value={projects.total ?? 0} hint={`${projects.active ?? 0} active`} tone="navy" />
        <StatCard icon={LuCalendarDays} label="Average progress" value={`${projects.averageProgress ?? 0}%`} hint="Across your projects" tone="accent" />
        <StatCard icon={LuWallet} label="Billed" value={formatINRCompact(finance.billed)} hint={`Paid ${formatINRCompact(finance.paid)}`} tone="success" />
        <StatCard icon={LuActivity} label="Outstanding" value={formatINRCompact(finance.outstanding)} hint={`${finance.overdueCount ?? 0} overdue invoice(s)`} tone={finance.overdueCount ? "danger" : "warning"} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <OverviewCard
          title="Your projects"
          description="Live schedule and physical progress."
          action={
            <Link to={`${basePath}/projects`} className="inline-flex items-center gap-1 font-display text-xs font-semibold uppercase tracking-wide text-accent-600 hover:text-accent-700">
              View all <LuArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          }
        >
          {(projects.list ?? []).length === 0 ? (
            <EmptyState title="No projects yet" description="A project appears once your work request is accepted." />
          ) : (
            <ul className="space-y-3">
              {projects.list.map((project) => (
                <li key={project._id}>
                  <Link
                    to={`${basePath}/projects/${project._id}`}
                    className="block rounded-md border border-concrete-200 px-3 py-3 transition-colors hover:border-navy-300 hover:bg-navy-50"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="min-w-0 font-display text-sm font-semibold text-navy-900">
                        {project.code} · {project.name}
                      </p>
                      <StatusBadge status={project.status} />
                    </div>
                    <p className="mt-1 text-xs text-concrete-500">
                      {project.site || "No site"} · {formatDate(project.startDate)} – {formatDate(project.endDate)}
                    </p>
                    <div className="mt-2">
                      <ProgressBar value={project.progress || 0} size="sm" showPercentage tone={project.health === "Delayed" ? "danger" : "accent"} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </OverviewCard>

        <OverviewCard
          title="Recent site reports"
          description="Approved daily reports shared by your contractor."
          action={
            <Link to={`${basePath}/daily-reports`} className="inline-flex items-center gap-1 font-display text-xs font-semibold uppercase tracking-wide text-accent-600 hover:text-accent-700">
              View all <LuArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          }
        >
          {(data.recentReports ?? []).length === 0 ? (
            <EmptyState title="No reports shared yet" description="Approved daily reports will appear here." />
          ) : (
            <ul className="space-y-3">
              {data.recentReports.map((report) => (
                <li key={report._id} className="rounded-md border border-concrete-200 px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-display text-sm font-semibold text-navy-900">
                      {report.project?.code || "Project"} · {formatDate(report.date)}
                    </p>
                    <Badge tone="success">Approved</Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-concrete-600">
                    {report.workCompleted}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </OverviewCard>
      </div>

      <OverviewCard title="Upcoming milestones" description="Contract milestones not yet completed.">
        {(data.upcomingMilestones ?? []).length === 0 ? (
          <p className="text-sm text-concrete-500">No open milestones are scheduled.</p>
        ) : (
          <ul className="divide-y divide-concrete-100">
            {data.upcomingMilestones.map((milestone, index) => (
              <li key={`${milestone.projectId}-${index}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-display text-sm font-medium text-navy-900">{milestone.title}</p>
                  <p className="text-xs text-concrete-500">{milestone.projectName}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-concrete-500">{formatDate(milestone.dueDate)}</span>
                  <StatusBadge status={milestone.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </OverviewCard>
    </div>
  );
};

const EmployeeOverview = ({ data, basePath }) => {
  if (!data) return null;
  const projects = data.projects || {};
  const tasks = data.tasks || {};
  const leave = data.leave || {};

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard icon={LuFolderKanban} label="My projects" value={projects.total ?? 0} hint={`${projects.active ?? 0} active`} tone="navy" />
        <StatCard icon={LuActivity} label="Open tasks" value={tasks.open ?? 0} hint={`${tasks.overdue ?? 0} overdue · ${tasks.dueThisWeek ?? 0} due this week`} tone={tasks.overdue ? "warning" : "accent"} />
        <StatCard icon={LuCalendarDays} label="Pending leave" value={leave.pending ?? 0} hint={`${leave.approved ?? 0} approved`} tone="warning" />
        <StatCard icon={LuHardHat} label="Attendance today" value={data.attendance || "Not marked"} tone={data.attendance === "Present" ? "success" : data.attendance ? "warning" : "neutral"} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <OverviewCard
          title="Upcoming tasks"
          description="Assigned work ordered by due date."
          action={
            <Link to={`${basePath}/tasks`} className="inline-flex items-center gap-1 font-display text-xs font-semibold uppercase tracking-wide text-accent-600 hover:text-accent-700">
              Task board <LuArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          }
        >
          {(data.upcomingTasks ?? []).length === 0 ? (
            <p className="text-sm text-concrete-500">Nothing is assigned right now.</p>
          ) : (
            <ul className="divide-y divide-concrete-100">
              {data.upcomingTasks.map((task) => (
                <li key={task._id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-display text-sm font-medium text-navy-900">{task.title}</p>
                    <p className="text-xs text-concrete-500">
                      {task.project?.code || "Project"} · due {formatDate(task.dueDate)}
                    </p>
                  </div>
                  <StatusBadge status={task.status} />
                </li>
              ))}
            </ul>
          )}
        </OverviewCard>

        <OverviewCard
          title="My projects"
          description="Sites and projects you are assigned to."
          action={
            <Link to={`${basePath}/projects`} className="inline-flex items-center gap-1 font-display text-xs font-semibold uppercase tracking-wide text-accent-600 hover:text-accent-700">
              View all <LuArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          }
        >
          {(projects.list ?? []).length === 0 ? (
            <p className="text-sm text-concrete-500">No project is assigned to you yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {projects.list.map((project) => (
                <li key={project._id}>
                  <Link
                    to={`${basePath}/projects/${project._id}`}
                    className="flex items-center justify-between gap-3 rounded-md border border-concrete-200 px-3 py-2.5 transition-colors hover:border-navy-300 hover:bg-navy-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-display text-sm font-semibold text-navy-900">{project.code} · {project.name}</p>
                      <p className="text-xs text-concrete-500">Due {formatDate(project.endDate)}</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-navy-900">{project.progress ?? 0}%</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </OverviewCard>
      </div>

      {data.latestSalary && (
        <OverviewCard title="Latest salary record" description="Most recent payroll entry.">
          <p className="font-display text-2xl font-semibold text-navy-900">
            {formatINR(data.latestSalary.netSalary)}
          </p>
          <p className="mt-1 text-xs text-concrete-500">
            Pay date {formatDate(data.latestSalary.payDate)}
          </p>
        </OverviewCard>
      )}
    </div>
  );
};

const Reports = () => {
  const user = useCurrentUser();
  const basePath = useAppSelector(selectHomePath);
  const admin = user?.role === "admin";
  const [tab, setTab] = useState("overview");
  const [from, setFrom] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 90);
    return dateInput(date);
  });
  const [to, setTo] = useState(() => dateInput(new Date()));
  const [exporting, setExporting] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const overviewQuery = useGetReportOverviewQuery();
  const projectQuery = useGetProjectReportQuery(undefined, { skip: !admin || tab !== "projects" });
  const financeQuery = useGetFinanceReportQuery(
    { from, to },
    { skip: !admin || tab !== "finance" }
  );
  const inventoryQuery = useGetInventoryReportQuery(undefined, {
    skip: !admin || tab !== "inventory",
  });
  const safetyQuery = useGetSafetyReportQuery({ from, to }, { skip: !admin || tab !== "safety" });
  const fieldQuery = useGetFieldReportQuery({ from, to }, { skip: !admin || tab !== "field" });

  const overview = overviewQuery.data?.overview;
  const isAdmin = admin && overviewQuery.data?.role === "admin";

  const finance = financeQuery.data;
  const projectRows = useMemo(() => projectQuery.data ?? [], [projectQuery.data]);

  const onExport = async (type) => {
    setExporting(type);
    setError("");
    setNotice("");
    try {
      const params = new URLSearchParams({ from, to });
      await downloadExport(`/report/export/${type}?${params.toString()}`, `${type}.csv`);
      setNotice(`${type} export downloaded.`);
    } catch (exportError) {
      setError(getErrorMessage(exportError, "The export could not be downloaded."));
    } finally {
      setExporting("");
    }
  };

  if (overviewQuery.isLoading) {
    return (
      <>
        <PageHeader title="Reports" description="Loading reporting data" />
        <CardSkeleton count={4} />
      </>
    );
  }

  if (isPermissionError(overviewQuery.error)) {
    return (
      <>
        <PageHeader title="Reports" />
        <Card><PermissionDenied /></Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Reports"
        description={
          admin
            ? "Project, finance, inventory, safety and field performance with period-based CSV exports."
            : "Your live project and account summary, scoped to the records you are allowed to see."
        }
        actions={
          <>
            {overviewQuery.isFetching && !overviewQuery.isLoading && (
              <span className="hidden text-xs text-concrete-400 sm:inline">Syncing…</span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => overviewQuery.refetch()}
              loading={overviewQuery.isFetching}
            >
              <LuRefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh
            </Button>
          </>
        }
      />

      {error && (
        <div className="mb-4">
          <Alert variant="error" onDismiss={() => setError("")}>{error}</Alert>
        </div>
      )}
      {notice && (
        <div className="mb-4">
          <Alert variant="success" onDismiss={() => setNotice("")}>{notice}</Alert>
        </div>
      )}
      {overviewQuery.error && overview && (
        <div className="mb-4">
          <Alert variant="warning">
            Showing the last known figures. {getErrorMessage(overviewQuery.error)}
          </Alert>
        </div>
      )}

      {!overview ? (
        <Card>
          <EmptyState
            icon={LuFileBarChart}
            title="No report data yet"
            description="Add projects, expenses and field records to build the reporting picture."
          />
        </Card>
      ) : (
        <>
          {admin && (
            <div className="mb-4 flex flex-col gap-3 sm:mb-5 xl:flex-row xl:items-center xl:justify-between">
              <FilterChips options={TABS} value={tab} onChange={setTab} ariaLabel="Select report" />
              <div className="flex flex-wrap items-end gap-2">
                <div className="w-36">
                  <Input
                    label="From"
                    type="date"
                    value={from}
                    max={to}
                    onChange={(event) => setFrom(event.target.value)}
                  />
                </div>
                <div className="w-36">
                  <Input
                    label="To"
                    type="date"
                    value={to}
                    min={from}
                    onChange={(event) => setTo(event.target.value)}
                  />
                </div>
                {(EXPORT_TYPES[tab] || []).map((entry) => (
                  <Button
                    key={entry.type}
                    variant="outline"
                    size="md"
                    onClick={() => onExport(entry.type)}
                    loading={exporting === entry.type}
                  >
                    <LuDownload className="h-4 w-4" aria-hidden="true" /> {entry.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {isAdmin && tab === "overview" && <AdminOverview data={overview} basePath={basePath} />}
          {!isAdmin && overviewQuery.data?.role === "client" && (
            <ClientOverview data={overview} basePath={basePath} />
          )}
          {!isAdmin && overviewQuery.data?.role === "employee" && (
            <EmployeeOverview data={overview} basePath={basePath} />
          )}

          {isAdmin && tab === "projects" && (
            <Card>
              <CardHeader
                title="Project performance"
                description={`${projectRows.length} active project(s), with schedule, tasks and commercial position.`}
              />
              {projectQuery.isLoading ? (
                <CardBody><p className="py-8 text-center text-sm text-concrete-500">Loading project report…</p></CardBody>
              ) : projectQuery.error ? (
                <CardBody><Alert variant="error">{getErrorMessage(projectQuery.error)}</Alert></CardBody>
              ) : projectRows.length === 0 ? (
                <EmptyState title="No active projects" description="Create a project to see its performance here." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-concrete-200 bg-concrete-50">
                      <tr>
                        {["Project", "Status", "Progress", "Tasks", "Field", "Contract", "Cost", "Margin"].map((heading) => (
                          <th key={heading} scope="col" className="whitespace-nowrap px-4 py-2.5 font-display text-xs font-semibold uppercase tracking-wider text-concrete-500">
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-concrete-100">
                      {projectRows.map((project) => (
                        <tr key={project._id} className="hover:bg-concrete-50">
                          <td className="min-w-[14rem] px-4 py-3">
                            <Link to={`${basePath}/projects/${project._id}`} className="font-display font-semibold text-navy-900 hover:text-accent-700">
                              {project.code} · {project.name}
                            </Link>
                            <p className="text-xs text-concrete-500">{project.client} · {project.site}</p>
                          </td>
                          <td className="px-4 py-3"><StatusBadge status={project.status} /></td>
                          <td className="whitespace-nowrap px-4 py-3 font-medium tabular-nums">{project.progress}%</td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-concrete-600">
                            {project.tasks.done}/{project.tasks.total} done
                            {project.tasks.overdue ? ` · ${project.tasks.overdue} overdue` : ""}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-concrete-600">
                            {project.field.dailyReports} reports
                            <span className="block text-concrete-500">{project.field.lastReportDate ? formatDate(project.field.lastReportDate) : "—"}</span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 tabular-nums">{formatINRCompact(project.finance.contractValue)}</td>
                          <td className="whitespace-nowrap px-4 py-3 tabular-nums">{formatINRCompact(project.finance.costToDate)}</td>
                          <td className={`whitespace-nowrap px-4 py-3 font-semibold tabular-nums ${project.finance.margin >= 0 ? "text-success-700" : "text-danger-700"}`}>
                            {formatINRCompact(project.finance.margin)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {isAdmin && tab === "finance" && (
            financeQuery.error ? (
              <ReportError query={financeQuery} />
            ) : finance ? (
              <div className="space-y-4 sm:space-y-6">
                <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                  <StatCard icon={LuWallet} label="Billed" value={formatINRCompact(finance.summary?.billed)} hint={`${formatDate(from)} – ${formatDate(to)}`} tone="navy" />
                  <StatCard icon={LuFileBarChart} label="Collected" value={formatINRCompact(finance.summary?.collected)} hint={`Cost ${formatINRCompact(finance.summary?.cost)}`} tone="success" />
                  <StatCard icon={LuActivity} label="Gross margin" value={formatINRCompact(finance.summary?.grossMargin)} hint={`${finance.summary?.marginPercent ?? 0}% of collected`} tone={(finance.summary?.grossMargin ?? 0) >= 0 ? "accent" : "danger"} />
                  <StatCard icon={LuFolderKanban} label="Receivables" value={formatINRCompact((finance.receivablesAging || []).reduce((sum, row) => sum + (row.amount || 0), 0))} hint="Open balance by age" tone="warning" />
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <OverviewCard title="Billed vs collected vs cost" description="Monthly movement for the selected period.">
                    <TrendBars
                      rows={finance.trends || []}
                      series={[
                        { key: "billed", label: "Billed", className: "bg-navy-600" },
                        { key: "collected", label: "Collected", className: "bg-success-500" },
                        { key: "cost", label: "Cost", className: "bg-warning-500" },
                      ]}
                    />
                  </OverviewCard>
                  <OverviewCard title="Cost by category" description="Approved and paid expenses in range.">
                    {(finance.costByCategory || []).length === 0 ? (
                      <p className="text-sm text-concrete-500">No costed expenses in this period.</p>
                    ) : (
                      <ul className="space-y-3">
                        {finance.costByCategory.map((row) => {
                          const max = Math.max(...finance.costByCategory.map((item) => item.total || 0), 1);
                          return (
                            <li key={row.category}>
                              <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                                <span className="text-navy-800">{row.category}</span>
                                <span className="font-display font-semibold tabular-nums text-navy-900">{formatINR(row.total)}</span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-concrete-100">
                                <div className="h-full rounded-full bg-accent-500" style={{ width: `${Math.max(3, (row.total / max) * 100)}%` }} />
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </OverviewCard>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <OverviewCard title="Receivables ageing" description="Outstanding balance by invoice age.">
                    <ul className="divide-y divide-concrete-100">
                      {(finance.receivablesAging || []).map((row) => (
                        <li key={row.bucket} className="flex items-center justify-between gap-3 py-2.5">
                          <span className="text-sm text-concrete-600">{row.bucket} <span className="text-xs">({row.count})</span></span>
                          <span className="font-display text-sm font-semibold tabular-nums text-navy-900">{formatINR(row.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  </OverviewCard>
                  <OverviewCard title="Top clients" description="Billed, collected and outstanding balances.">
                    {(finance.topClients || []).length === 0 ? (
                      <p className="text-sm text-concrete-500">No invoices in this period.</p>
                    ) : (
                      <ul className="divide-y divide-concrete-100">
                        {finance.topClients.map((row) => (
                          <li key={row.client} className="py-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <p className="min-w-0 truncate font-display text-sm font-medium text-navy-900">{row.client}</p>
                              <p className="text-sm font-semibold tabular-nums text-navy-900">{formatINR(row.billed)}</p>
                            </div>
                            <p className="text-xs text-concrete-500">
                              Collected {formatINR(row.collected)} · Outstanding {formatINR(row.outstanding)}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </OverviewCard>
                </div>
              </div>
            ) : (
              <ReportLoading label="finance report" />
            )
          )}

          {isAdmin && tab === "inventory" && (
            inventoryQuery.error ? (
              <ReportError query={inventoryQuery} />
            ) : inventoryQuery.isLoading && !inventoryQuery.data ? (
              <ReportLoading label="inventory report" />
            ) : (
            <div className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                <StatCard icon={LuPackage} label="Stock value" value={formatINRCompact(inventoryQuery.data?.summary?.stockValue)} hint="Across all sites" tone="navy" />
                <StatCard icon={LuFolderKanban} label="SKUs on hand" value={inventoryQuery.data?.summary?.skus ?? 0} hint={`${inventoryQuery.data?.summary?.lines ?? 0} site lines`} tone="accent" />
                <StatCard icon={LuActivity} label="Site lines" value={inventoryQuery.data?.summary?.lines ?? 0} hint="Positive balances" tone="success" />
                <StatCard icon={LuShieldCheck} label="Low stock" value={(inventoryQuery.data?.summary?.bySite || []).reduce((sum, row) => sum + (row.lowStock || 0), 0)} hint="At or below reorder" tone="warning" />
              </div>
              <OverviewCard title="Stock by site" description="Valuation of positive balances per site.">
                {(inventoryQuery.data?.summary?.bySite || []).length === 0 ? (
                  <p className="text-sm text-concrete-500">No stock is currently on hand.</p>
                ) : (
                  <ul className="divide-y divide-concrete-100">
                    {inventoryQuery.data.summary.bySite.map((row) => (
                      <li key={row.site} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                        <div>
                          <p className="font-display text-sm font-medium text-navy-900">{row.site}</p>
                          <p className="text-xs text-concrete-500">{row.lines} material line(s)</p>
                        </div>
                        <div className="flex items-center gap-3">
                          {row.lowStock > 0 && <Badge tone="warning">{row.lowStock} low</Badge>}
                          <span className="font-display text-sm font-semibold tabular-nums text-navy-900">{formatINR(row.value)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </OverviewCard>
              <Card>
                <CardHeader title="Stock ledger balances" description="Latest on-hand quantity per site and material." />
                {inventoryQuery.isLoading ? (
                  <CardBody><p className="py-8 text-center text-sm text-concrete-500">Loading stock report…</p></CardBody>
                ) : (inventoryQuery.data?.rows || []).length === 0 ? (
                  <EmptyState title="No stock" description="Receive material to populate the ledger." />
                ) : (
                  <div className="max-h-[32rem] overflow-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="sticky top-0 border-b border-concrete-200 bg-concrete-50">
                        <tr>
                          {["Site", "SKU", "Material", "On hand", "Reorder", "Value"].map((heading) => (
                            <th key={heading} scope="col" className="whitespace-nowrap px-4 py-2.5 font-display text-xs font-semibold uppercase tracking-wider text-concrete-500">{heading}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-concrete-100">
                        {inventoryQuery.data.rows.map((row) => (
                          <tr key={`${row.siteId}-${row.materialId}`} className="hover:bg-concrete-50">
                            <td className="whitespace-nowrap px-4 py-2.5">{row.site}</td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-xs text-concrete-500">{row.sku}</td>
                            <td className="px-4 py-2.5">{row.material}</td>
                            <td className={`whitespace-nowrap px-4 py-2.5 font-medium tabular-nums ${row.balance <= (row.reorderLevel || 0) ? "text-warning-700" : "text-navy-900"}`}>
                              {row.balance} {row.unit}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-xs text-concrete-500">{row.reorderLevel ?? 0}</td>
                            <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{formatINR(row.value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
            )
          )}

          {isAdmin && tab === "safety" && (
            safetyQuery.error ? (
              <ReportError query={safetyQuery} />
            ) : safetyQuery.isLoading && !safetyQuery.data ? (
              <ReportLoading label="safety report" />
            ) : (
            <div className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                <StatCard icon={LuShieldCheck} label="Incidents" value={safetyQuery.data?.summary?.incidents ?? 0} hint="In selected period" tone="navy" />
                <StatCard icon={LuActivity} label="Lost-time days" value={safetyQuery.data?.summary?.lostTimeDays ?? 0} hint="Reported" tone="warning" />
                <StatCard icon={LuCalendarDays} label="Still open" value={safetyQuery.data?.summary?.open ?? 0} hint="Open or investigating" tone={(safetyQuery.data?.summary?.open ?? 0) ? "warning" : "success"} />
                <StatCard icon={LuShieldCheck} label="High / critical" value={safetyQuery.data?.summary?.criticalOpen ?? 0} hint="Open and severe" tone={(safetyQuery.data?.summary?.criticalOpen ?? 0) ? "danger" : "success"} />
              </div>
              <OverviewCard title="Monthly safety trend" description="Incidents and lost-time days by month.">
                {(safetyQuery.data?.trends || []).length === 0 ? (
                  <p className="text-sm text-concrete-500">No incidents in this period.</p>
                ) : (
                  <ul className="divide-y divide-concrete-100">
                    {safetyQuery.data.trends.map((row) => (
                      <li key={row.month} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                        <div>
                          <p className="font-display text-sm font-medium text-navy-900">{monthLabel(row.month)}</p>
                          <p className="text-xs text-concrete-500">
                            {Object.entries(row.bySeverity || {}).map(([severity, count]) => `${severity}: ${count}`).join(" · ") || "No severity split"}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge tone={row.incidents ? "warning" : "success"}>{row.incidents} incident(s)</Badge>
                          <span className="text-xs text-concrete-500">{row.lostTimeDays} lost day(s)</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </OverviewCard>
            </div>
            )
          )}

          {isAdmin && tab === "field" && (
            fieldQuery.error ? (
              <ReportError query={fieldQuery} />
            ) : fieldQuery.isLoading && !fieldQuery.data ? (
              <ReportLoading label="field report" />
            ) : (
            <div className="space-y-4 sm:space-y-6">
              <OverviewCard title="Daily report coverage" description="Reports filed per project in the selected period.">
                {(fieldQuery.data?.projects || []).length === 0 ? (
                  <p className="text-sm text-concrete-500">No projects are available.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="border-b border-concrete-200 bg-concrete-50">
                        <tr>
                          {["Project", "Status", "Approved", "Submitted", "Draft", "Workforce-days"].map((heading) => (
                            <th key={heading} scope="col" className="whitespace-nowrap px-4 py-2.5 font-display text-xs font-semibold uppercase tracking-wider text-concrete-500">{heading}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-concrete-100">
                        {fieldQuery.data.projects.map((project) => (
                          <tr key={project._id} className="hover:bg-concrete-50">
                            <td className="min-w-[14rem] px-4 py-2.5">
                              <Link to={`${basePath}/projects/${project._id}`} className="font-display font-medium text-navy-900 hover:text-accent-700">
                                {project.code} · {project.name}
                              </Link>
                              <p className="text-xs text-concrete-500">{project.site}</p>
                            </td>
                            <td className="px-4 py-2.5"><StatusBadge status={project.status} /></td>
                            <td className="px-4 py-2.5 tabular-nums">{project.reports.approved}</td>
                            <td className="px-4 py-2.5 tabular-nums">{project.reports.submitted}</td>
                            <td className="px-4 py-2.5 tabular-nums">{project.reports.draft}</td>
                            <td className="px-4 py-2.5 tabular-nums">{number(project.reports.workforce)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </OverviewCard>
            </div>
            )
          )}
        </>
      )}
    </>
  );
};

export default Reports;
