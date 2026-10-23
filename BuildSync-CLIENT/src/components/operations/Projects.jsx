import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  LuArrowRight,
  LuBuilding2,
  LuCalendarDays,
  LuFolderKanban,
  LuPlus,
  LuSearch,
  LuUsers,
} from "react-icons/lu";
import PageHeader from "../../components/ui/PageHeader";
import { Card, CardBody } from "../../components/ui/Card";
import StatCard from "../../components/ui/StatCard";
import Button from "../../components/ui/Button";
import { StatusBadge } from "../../components/ui/Badge";
import ProgressBar from "../../components/ui/ProgressBar";
import { Alert, CardSkeleton, EmptyState } from "../../components/ui/Feedback";
import { FilterChips } from "../../components/ui/Toolbar";
import { getErrorMessage, isPermissionError } from "../../lib/api";
import { useAppSelector } from "../../app/hooks";
import { selectHomePath } from "../../features/auth/authSelectors";
import { useCurrentUser } from "../../features/auth/useSession";
import { useGetProjectsQuery } from "../../services/api/endpoints/projectsApi";
import { formatINRCompact } from "../../utils/format";
import {
  clientName,
  formatDate,
  projectName,
} from "../../components/operations/shared";

const STATUSES = [
  { value: "", label: "All" },
  { value: "Planning", label: "Planning" },
  { value: "Mobilisation", label: "Mobilising" },
  { value: "In Progress", label: "In Progress" },
  { value: "On Hold", label: "On Hold" },
  { value: "Completed", label: "Completed" },
  { value: "Closed", label: "Closed" },
];

const ProjectCard = ({ project, basePath, role }) => {
  const finance = project.finance;
  return (
    <Card className="group flex h-full flex-col transition-shadow duration-200 hover:shadow-card-hover">
      <CardBody className="flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-2xs font-semibold uppercase tracking-[0.16em] text-concrete-500">
              {project.code}
            </p>
            <h2 className="mt-1 font-display text-lg font-semibold leading-snug text-navy-900 break-words">
              <Link to={`${basePath}/projects/${project._id}`} className="hover:text-accent-700">
                {projectName(project)}
              </Link>
            </h2>
          </div>
          <StatusBadge status={project.status} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-concrete-500">
          <span className="inline-flex items-center gap-1.5">
            <LuBuilding2 className="h-3.5 w-3.5" aria-hidden="true" />
            {project.site?.dep_name || "No site"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <LuCalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            {formatDate(project.startDate)} – {formatDate(project.endDate)}
          </span>
          {role !== "employee" && project.client && (
            <span className="inline-flex items-center gap-1.5">
              <LuUsers className="h-3.5 w-3.5" aria-hidden="true" />
              {clientName(project.client)}
            </span>
          )}
        </div>

        <div className="mt-4">
          <ProgressBar
            value={project.progress ?? 0}
            label="Physical progress"
            showPercentage
            size="sm"
            tone={project.health === "Delayed" ? "danger" : "accent"}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <StatusBadge status={project.health || "On Track"} />
          <StatusBadge status={project.priority || "Normal"} />
          {project.taskSummary?.total > 0 && (
            <span className="text-xs text-concrete-500">
              {project.taskSummary.done}/{project.taskSummary.total} tasks
            </span>
          )}
        </div>

        {role === "admin" && finance && (
          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-concrete-100 pt-3 text-xs">
            <div>
              <dt className="text-concrete-500">Contract</dt>
              <dd className="mt-0.5 font-display font-semibold text-navy-900">
                {formatINRCompact(project.contractValue)}
              </dd>
            </div>
            <div>
              <dt className="text-concrete-500">Cost to date</dt>
              <dd className="mt-0.5 font-display font-semibold text-navy-900">
                {formatINRCompact(finance.costToDate)}
              </dd>
            </div>
          </dl>
        )}

        {role === "client" && finance && (
          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-concrete-100 pt-3 text-xs">
            <div>
              <dt className="text-concrete-500">Billed</dt>
              <dd className="mt-0.5 font-display font-semibold text-navy-900">
                {formatINRCompact(finance.billed)}
              </dd>
            </div>
            <div>
              <dt className="text-concrete-500">Outstanding</dt>
              <dd className="mt-0.5 font-display font-semibold text-warning-700">
                {formatINRCompact(finance.outstanding)}
              </dd>
            </div>
          </dl>
        )}

        <Link
          to={`${basePath}/projects/${project._id}`}
          className="mt-4 inline-flex items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-wide text-accent-700 transition-colors hover:text-accent-800"
        >
          Open project
          <LuArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </CardBody>
    </Card>
  );
};

const Projects = () => {
  const user = useCurrentUser();
  const basePath = useAppSelector(selectHomePath);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  const {
    data,
    error,
    isLoading,
    isFetching,
    refetch,
  } = useGetProjectsQuery({ limit: 200, status: status || undefined });

  const projects = useMemo(() => {
    const list = data?.projects ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return list;
    return list.filter((project) =>
      [project.name, project.code, project.site?.dep_name, project.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [data, search]);

  const metrics = useMemo(() => {
    const list = data?.projects ?? [];
    return {
      total: list.length,
      active: list.filter((p) => ["Planning", "Mobilisation", "In Progress"].includes(p.status)).length,
      delayed: list.filter((p) => p.health === "Delayed" || p.health === "At Risk").length,
      value: list.reduce((sum, p) => sum + (Number(p.contractValue) || 0), 0),
      cost: list.reduce((sum, p) => sum + (Number(p.finance?.costToDate) || 0), 0),
    };
  }, [data]);

  const permissionError = isPermissionError(error);

  return (
    <>
      <PageHeader
        title="Projects"
        description="Every active job, its site team, delivery progress and commercial position."
        actions={
          user?.role === "admin" ? (
            <Link to={`${basePath}/projects/new`}>
              <Button variant="accent">
                <LuPlus className="h-4 w-4" aria-hidden="true" />
                New Project
              </Button>
            </Link>
          ) : null
        }
      />

      {permissionError ? (
        <Card>
          <CardBody>
            <Alert variant="warning">
              Your account does not have permission to view projects.
            </Alert>
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 sm:mb-5">
            <StatCard icon={LuFolderKanban} label="Projects" value={metrics.total} hint={`${metrics.active} active`} tone="navy" />
            <StatCard
              icon={LuCalendarDays}
              label="Needs attention"
              value={metrics.delayed}
              hint="At risk or delayed"
              tone={metrics.delayed ? "warning" : "success"}
            />
            {user?.role === "admin" ? (
              <>
                <StatCard icon={LuBuilding2} label="Contract value" value={formatINRCompact(metrics.value)} hint="All visible projects" tone="accent" />
                <StatCard icon={LuUsers} label="Cost to date" value={formatINRCompact(metrics.cost)} hint="Approved project expenses" tone="info" />
              </>
            ) : (
              <>
                <StatCard icon={LuBuilding2} label="Sites" value={new Set((data?.projects ?? []).map((p) => p.site?._id).filter(Boolean)).size} hint="With active work" tone="accent" />
                <StatCard icon={LuUsers} label="Portfolio progress" value={`${Math.round(metrics.total ? (data?.projects ?? []).reduce((s, p) => s + (p.progress || 0), 0) / metrics.total : 0)}%`} hint="Average across projects" tone="success" />
              </>
            )}
          </div>

          <Card>
            <div className="flex flex-col gap-3 border-b border-concrete-200 px-4 py-3.5 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full sm:max-w-xs">
                <LuSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-concrete-400" aria-hidden="true" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search name, code or site"
                  aria-label="Search projects"
                  className="w-full rounded-md border border-concrete-300 bg-white py-2 pl-9 pr-3 text-sm text-navy-900 placeholder:text-concrete-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-400"
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {isFetching && !isLoading && <span className="text-xs text-concrete-400">Syncing…</span>}
                <FilterChips options={STATUSES} value={status} onChange={setStatus} ariaLabel="Filter projects by status" />
              </div>
            </div>

            {isLoading ? (
              <div className="p-4 sm:p-5">
                <CardSkeleton count={3} className="lg:grid-cols-3" />
              </div>
            ) : error ? (
              <EmptyState
                title="Could not load projects"
                description={getErrorMessage(error)}
                action={<Button variant="outline" onClick={refetch}>Try again</Button>}
              />
            ) : projects.length === 0 ? (
              <EmptyState
                icon={LuFolderKanban}
                title={search || status ? "No matching projects" : "No projects yet"}
                description={
                  search || status
                    ? "Adjust the search or status filter."
                    : "A project starts when a client request is accepted or an internal job is created."
                }
                action={
                  user?.role === "admin" ? (
                    <Link to={`${basePath}/projects/new`}>
                      <Button variant="accent">Create the first project</Button>
                    </Link>
                  ) : null
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 p-4 sm:p-5 xl:grid-cols-2 2xl:grid-cols-3">
                {projects.map((project) => (
                  <ProjectCard
                    key={project._id}
                    project={project}
                    basePath={basePath}
                    role={user?.role}
                  />
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
};

export default Projects;
