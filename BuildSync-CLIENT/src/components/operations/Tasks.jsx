import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  LuCalendarClock,
  LuCheckCircle2,
  LuCircleDashed,
  LuClipboardList,
  LuClock,
  LuPlus,
  LuSearch,
  LuTrash2,
} from "react-icons/lu";
import PageHeader from "../../components/ui/PageHeader";
import { Card, CardBody } from "../../components/ui/Card";
import StatCard from "../../components/ui/StatCard";
import Button from "../../components/ui/Button";
import Badge, { StatusBadge } from "../../components/ui/Badge";
import { Alert, EmptyState } from "../../components/ui/Feedback";
import { FilterChips } from "../../components/ui/Toolbar";
import Modal from "../../components/ui/Modal";
import ConfirmDialog, { useConfirm } from "../../components/ui/ConfirmDialog";
import { Input, Select, Textarea } from "../../components/ui/Form";
import { getErrorMessage } from "../../lib/api";
import { useCurrentUser } from "../../features/auth/useSession";
import {
  useCreateTaskMutation,
  useDeleteTaskMutation,
  useGetTasksQuery,
  useUpdateTaskMutation,
} from "../../services/api/endpoints/fieldApi";
import {
  dateInput,
  daysUntil,
  employeeName,
  formatDate,
  projectName,
  useOperationReference,
} from "../../components/operations/shared";

const STATUSES = [
  { value: "", label: "All" },
  { value: "To Do", label: "To Do" },
  { value: "In Progress", label: "In Progress" },
  { value: "Blocked", label: "Blocked" },
  { value: "Done", label: "Done" },
];

const EMPTY_TASK = {
  project: "",
  title: "",
  description: "",
  assignee: "",
  status: "To Do",
  priority: "Normal",
  startDate: "",
  dueDate: "",
  estimatedHours: 0,
  actualHours: 0,
  blockedReason: "",
  notes: "",
};

const Tasks = () => {
  const user = useCurrentUser();
  const admin = user?.role === "admin";
  const { id: routeTaskId } = useParams();
  const [searchParams] = useSearchParams();
  const [projectFilter, setProjectFilter] = useState(searchParams.get("project") || "");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_TASK);
  const [error, setError] = useState("");
  const confirm = useConfirm();

  const reference = useOperationReference({ projects: true, employees: admin });
  const { data, isLoading, error: loadError, refetch } = useGetTasksQuery({
    limit: 200,
    project: projectFilter || undefined,
  });
  const [createTask, createState] = useCreateTaskMutation();
  const [updateTask, updateState] = useUpdateTaskMutation();
  const [deleteTask, deleteState] = useDeleteTaskMutation();

  const tasks = useMemo(() => {
    const list = data?.tasks ?? [];
    const term = search.trim().toLowerCase();
    return list.filter((task) => {
      if (status && task.status !== status) return false;
      if (!term) return true;
      return [task.title, task.description, task.project?.name, employeeName(task.assignee)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [data, search, status]);

  const metrics = useMemo(() => {
    const list = data?.tasks ?? [];
    return {
      total: list.length,
      open: list.filter((task) => task.status !== "Done").length,
      overdue: list.filter((task) => task.status !== "Done" && daysUntil(task.dueDate) !== null && daysUntil(task.dueDate) < 0).length,
      done: list.filter((task) => task.status === "Done").length,
    };
  }, [data]);

  useEffect(() => {
    if (searchParams.get("project")) setProjectFilter(searchParams.get("project"));
  }, [searchParams]);

  const openCreate = () => {
    setEditing(null);
    setError("");
    setForm({ ...EMPTY_TASK, project: projectFilter || reference.projects[0]?._id || "" });
    setDialogOpen(true);
  };

  const openEdit = (task) => {
    setEditing(task);
    setError("");
    setForm({
      project: task.project?._id || task.project || "",
      title: task.title || "",
      description: task.description || "",
      assignee: task.assignee?._id || task.assignee || "",
      status: task.status || "To Do",
      priority: task.priority || "Normal",
      startDate: dateInput(task.startDate),
      dueDate: dateInput(task.dueDate),
      estimatedHours: task.estimatedHours ?? 0,
      actualHours: task.actualHours ?? 0,
      blockedReason: task.blockedReason || "",
      notes: task.notes || "",
    });
    setDialogOpen(true);
  };

  useEffect(() => {
    if (!routeTaskId) return;
    const match = (data?.tasks ?? []).find((task) => task._id === routeTaskId);
    if (match) openEdit(match);
  }, [routeTaskId, data]);

  const update = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (!form.title.trim()) {
      setError("Give the task a title.");
      return;
    }
    try {
      if (editing) {
        const body = admin
          ? {
              project: form.project,
              title: form.title.trim(),
              description: form.description,
              assignee: form.assignee || null,
              status: form.status,
              priority: form.priority,
              startDate: form.startDate || null,
              dueDate: form.dueDate || null,
              estimatedHours: Number(form.estimatedHours) || 0,
              actualHours: Number(form.actualHours) || 0,
              blockedReason: form.blockedReason,
              notes: form.notes,
            }
          : {
              status: form.status,
              actualHours: Number(form.actualHours) || 0,
              blockedReason: form.blockedReason,
              notes: form.notes,
            };
        await updateTask({ id: editing._id, ...body }).unwrap();
      } else {
        await createTask({
          project: form.project,
          title: form.title.trim(),
          description: form.description,
          assignee: form.assignee || null,
          status: form.status,
          priority: form.priority,
          startDate: form.startDate || undefined,
          dueDate: form.dueDate || undefined,
          estimatedHours: Number(form.estimatedHours) || 0,
          notes: form.notes,
        }).unwrap();
      }
      setDialogOpen(false);
    } catch (submitError) {
      setError(getErrorMessage(submitError, "The task could not be saved."));
    }
  };

  const onDelete = async () => {
    try {
      await deleteTask(confirm.target).unwrap();
      confirm.close();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
      confirm.close();
    }
  };

  return (
    <>
      <PageHeader
        title={admin ? "Tasks" : "My Tasks"}
        description={
          admin
            ? "Assign and track the work that moves projects forward."
            : "Everything assigned to you, in priority and due-date order."
        }
        actions={
          admin ? (
            <Button variant="accent" onClick={openCreate}>
              <LuPlus className="h-4 w-4" aria-hidden="true" /> New Task
            </Button>
          ) : null
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 sm:mb-5">
        <StatCard icon={LuClipboardList} label="Total tasks" value={metrics.total} tone="navy" />
        <StatCard icon={LuCircleDashed} label="Open" value={metrics.open} hint="Not yet done" tone="accent" />
        <StatCard icon={LuCalendarClock} label="Overdue" value={metrics.overdue} tone={metrics.overdue ? "danger" : "success"} />
        <StatCard icon={LuCheckCircle2} label="Completed" value={metrics.done} tone="success" />
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-concrete-200 px-4 py-3.5 sm:px-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-xs">
              <LuSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-concrete-400" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search tasks"
                aria-label="Search tasks"
                className="w-full rounded-md border border-concrete-300 bg-white py-2 pl-9 pr-3 text-sm text-navy-900 placeholder:text-concrete-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-400"
              />
            </div>
            <Select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} aria-label="Filter by project" className="sm:!w-56">
              <option value="">All projects</option>
              {reference.projects.map((project) => (
                <option key={project._id} value={project._id}>{projectName(project)}</option>
              ))}
            </Select>
          </div>
          <FilterChips options={STATUSES} value={status} onChange={setStatus} ariaLabel="Filter tasks by status" />
        </div>

        {isLoading ? (
          <CardBody><p className="py-8 text-center text-sm text-concrete-500">Loading tasks…</p></CardBody>
        ) : loadError ? (
          <EmptyState
            title="Could not load tasks"
            description={getErrorMessage(loadError)}
            action={<Button variant="outline" onClick={refetch}>Try again</Button>}
          />
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={LuClipboardList}
            title={search || status ? "No matching tasks" : "No tasks yet"}
            description={
              admin
                ? "Create a task and assign it to a site team member."
                : "When a task is assigned to you it will appear here."
            }
            action={admin ? <Button variant="accent" onClick={openCreate}>Create a task</Button> : null}
          />
        ) : (
          <ul className="divide-y divide-concrete-100">
            {tasks.map((task) => {
              const remaining = daysUntil(task.dueDate);
              const overdue = task.status !== "Done" && remaining !== null && remaining < 0;
              return (
                <li key={task._id} className="px-4 py-3.5 sm:px-5">
                  <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                    <button
                      type="button"
                      onClick={() => openEdit(task)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-display text-sm font-semibold leading-snug text-navy-900">
                          {task.title}
                        </p>
                        <StatusBadge status={task.status} />
                        <StatusBadge status={task.priority} />
                        {overdue && <Badge tone="danger" dot>Overdue</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-concrete-500">
                        {task.project?.code || "Project"} · {projectName(task.project)}
                        {admin ? ` · ${employeeName(task.assignee)}` : ""}
                      </p>
                      {task.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-concrete-600">{task.description}</p>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-concrete-500">
                        <span className="inline-flex items-center gap-1">
                          <LuClock className="h-3.5 w-3.5" />
                          Due {formatDate(task.dueDate)}
                          {remaining !== null && task.status !== "Done" && (
                            <span className={overdue ? "text-danger-600" : ""}>
                              ({overdue ? `${Math.abs(remaining)}d late` : `${remaining}d left`})
                            </span>
                          )}
                        </span>
                        <span>{task.actualHours || 0}/{task.estimatedHours || 0} h</span>
                        {task.blockedReason && (
                          <span className="text-warning-700">Blocked: {task.blockedReason}</span>
                        )}
                      </div>
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button variant="outline" size="sm" onClick={() => openEdit(task)}>
                        {admin ? "Edit" : "Update"}
                      </Button>
                      {admin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete task ${task.title}`}
                          onClick={() => confirm.open(task._id)}
                        >
                          <LuTrash2 className="h-4 w-4 text-danger-600" />
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Modal
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? (admin ? "Edit task" : "Update task") : "New task"}
        description={editing && !admin ? "Record progress, hours and anything blocking the work." : undefined}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              variant="accent"
              form="task-form"
              type="submit"
              loading={createState.isLoading || updateState.isLoading}
            >
              {editing ? "Save changes" : "Create task"}
            </Button>
          </>
        }
      >
        <form id="task-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {error && <div className="sm:col-span-2"><Alert variant="error">{error}</Alert></div>}
          {admin ? (
            <>
              <div className="sm:col-span-2">
                <Input label="Task title" value={form.title} onChange={update("title")} required />
              </div>
              <Select label="Project" value={form.project} onChange={update("project")} required>
                <option value="">Select a project</option>
                {reference.projects.map((project) => (
                  <option key={project._id} value={project._id}>{project.code} · {projectName(project)}</option>
                ))}
              </Select>
              <Select label="Assignee" value={form.assignee} onChange={update("assignee")}>
                <option value="">Unassigned</option>
                {reference.employees.map((employee) => (
                  <option key={employee._id} value={employee._id}>
                    {employee.userId?.name || employee.employeeId}
                  </option>
                ))}
              </Select>
              <Select label="Status" value={form.status} onChange={update("status")}>
                {["To Do", "In Progress", "Blocked", "Done"].map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </Select>
              <Select label="Priority" value={form.priority} onChange={update("priority")}>
                {["Low", "Normal", "High", "Critical"].map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </Select>
              <Input label="Start date" type="date" value={form.startDate} onChange={update("startDate")} />
              <Input label="Due date" type="date" value={form.dueDate} onChange={update("dueDate")} />
              <Input label="Estimated hours" type="number" min="0" value={form.estimatedHours} onChange={update("estimatedHours")} />
              <Input label="Actual hours" type="number" min="0" value={form.actualHours} onChange={update("actualHours")} />
              <div className="sm:col-span-2">
                <Textarea label="Description" rows={3} value={form.description} onChange={update("description")} />
              </div>
            </>
          ) : (
            <>
              <div className="sm:col-span-2 rounded-md bg-concrete-50 p-3">
                <p className="font-display text-sm font-semibold text-navy-900">{editing?.title}</p>
                <p className="text-xs text-concrete-500">{projectName(editing?.project)} · due {formatDate(editing?.dueDate)}</p>
              </div>
              <Select label="Status" value={form.status} onChange={update("status")}>
                {["To Do", "In Progress", "Blocked", "Done"].map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </Select>
              <Input label="Actual hours" type="number" min="0" value={form.actualHours} onChange={update("actualHours")} />
            </>
          )}

          {(form.status === "Blocked" || form.blockedReason) && (
            <div className="sm:col-span-2">
              <Input
                label="What is blocking this task?"
                value={form.blockedReason}
                onChange={update("blockedReason")}
              />
            </div>
          )}
          <div className="sm:col-span-2">
            <Textarea label="Notes" rows={2} value={form.notes} onChange={update("notes")} />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirm.confirmOpen}
        onCancel={confirm.close}
        onConfirm={onDelete}
        title="Delete this task?"
        description="The task and its progress notes will be removed. This cannot be undone."
        confirmLabel="Delete task"
        loading={deleteState.isLoading}
      />
    </>
  );
};

export default Tasks;
