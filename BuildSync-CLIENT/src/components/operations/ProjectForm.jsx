import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import FormPage from "../../components/ui/FormPage";
import { Input, Select, Textarea } from "../../components/ui/Form";
import { Alert, PageLoader } from "../../components/ui/Feedback";
import { getErrorMessage } from "../../lib/api";
import { useAppSelector } from "../../app/hooks";
import { selectHomePath } from "../../features/auth/authSelectors";
import {
  useCreateProjectMutation,
  useGetProjectQuery,
  useGetWorkRequestPrefillQuery,
  useUpdateProjectMutation,
} from "../../services/api/endpoints/projectsApi";
import { useOperationReference, dateInput } from "../../components/operations/shared";

const EMPTY = {
  name: "",
  code: "",
  description: "",
  site: "",
  client: "",
  manager: "",
  team: [],
  status: "Planning",
  priority: "Normal",
  health: "On Track",
  startDate: "",
  endDate: "",
  contractValue: "",
  estimatedCost: "",
  progress: 0,
  tags: "",
};

const ProjectForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const basePath = useAppSelector(selectHomePath);
  const [searchParams] = useSearchParams();
  const workRequestId = searchParams.get("workRequest");
  const editing = Boolean(id);

  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const reference = useOperationReference({ sites: true, clients: true, employees: true });

  const { data: project, isLoading: loadingProject } = useGetProjectQuery(id, { skip: !id });
  const { data: prefill } = useGetWorkRequestPrefillQuery(workRequestId, {
    skip: !workRequestId || editing,
  });
  const [createProject, createState] = useCreateProjectMutation();
  const [updateProject, updateState] = useUpdateProjectMutation();

  const submitting = createState.isLoading || updateState.isLoading;

  useEffect(() => {
    if (!project) return;
    setForm({
      name: project.name || "",
      code: project.code || "",
      description: project.description || "",
      site: project.site?._id || project.site || "",
      client: project.client?._id || project.client || "",
      manager: project.manager?._id || project.manager || "",
      team: (project.team || []).map((member) => member?._id || member).filter(Boolean),
      status: project.status || "Planning",
      priority: project.priority || "Normal",
      health: project.health || "On Track",
      startDate: dateInput(project.startDate),
      endDate: dateInput(project.endDate),
      contractValue: project.contractValue ?? "",
      estimatedCost: project.estimatedCost ?? "",
      progress: project.progress ?? 0,
      tags: (project.tags || []).join(", "),
    });
  }, [project]);

  useEffect(() => {
    if (!prefill) return;
    setForm((current) => ({
      ...current,
      name: prefill.name || current.name,
      description: prefill.description || current.description,
      client: prefill.client || current.client,
      startDate: dateInput(prefill.startDate) || current.startDate,
      endDate: dateInput(prefill.endDate) || current.endDate,
    }));
  }, [prefill]);

  const teamOptions = useMemo(
    () => reference.employees.filter((employee) => employee._id !== form.manager),
    [reference.employees, form.manager]
  );

  const update = (field) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
  };

  const toggleTeam = (employeeId) => {
    setForm((current) => ({
      ...current,
      team: current.team.includes(employeeId)
        ? current.team.filter((value) => value !== employeeId)
        : [...current.team, employeeId],
    }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!form.name.trim()) {
      setError("Give the project a name.");
      return;
    }
    if (!form.site) {
      setError("Choose the construction site.");
      return;
    }
    if (!form.startDate || !form.endDate) {
      setError("Start and end dates are required.");
      return;
    }
    if (new Date(form.endDate) < new Date(form.startDate)) {
      setError("The end date cannot be before the start date.");
      return;
    }

    const body = {
      name: form.name.trim(),
      description: form.description,
      site: form.site,
      client: form.client || null,
      manager: form.manager || null,
      team: form.team,
      status: form.status,
      priority: form.priority,
      health: form.health,
      startDate: form.startDate,
      endDate: form.endDate,
      contractValue: Number(form.contractValue) || 0,
      estimatedCost: Number(form.estimatedCost) || 0,
      progress: Number(form.progress) || 0,
      tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
    };
    if (!editing && form.code.trim()) body.code = form.code.trim();
    if (!editing && workRequestId) body.workRequestId = workRequestId;

    try {
      const saved = editing
        ? await updateProject({ id, ...body }).unwrap()
        : await createProject(body).unwrap();
      navigate(`${basePath}/projects/${saved.project._id}`);
    } catch (submitError) {
      setError(getErrorMessage(submitError, "The project could not be saved."));
    }
  };

  if (editing && loadingProject) {
    return <PageLoader label="Loading project" />;
  }

  return (
    <FormPage
      title={editing ? "Edit project" : workRequestId ? "Project from work request" : "New project"}
      description={
        editing
          ? "Update delivery, ownership and commercial terms. All changes are audited."
          : "A project turns an accepted request into scheduled, costed execution."
      }
      backTo={`${basePath}/projects`}
      submitLabel={editing ? "Save changes" : "Create project"}
      submitting={submitting}
      error={error}
      onSubmit={onSubmit}
      onCancel={() => navigate(`${basePath}/projects`)}
      width="lg"
    >
      <div className="sm:col-span-2">
        <Input
          label="Project name"
          name="name"
          value={form.name}
          onChange={update("name")}
          required
          placeholder="e.g. Tower Alpha - Residential"
        />
      </div>
      <Input
        label="Project code"
        name="code"
        value={form.code}
        onChange={update("code")}
        disabled={editing}
        hint={editing ? "Project codes never change." : "Leave blank to allocate the next code automatically."}
        placeholder="PRJ-2026-0001"
      />
      <Select label="Status" name="status" value={form.status} onChange={update("status")}>
        {["Planning", "Mobilisation", "In Progress", "On Hold", "Completed", "Handover", "Closed", "Cancelled"].map((status) => (
          <option key={status} value={status}>{status}</option>
        ))}
      </Select>
      <Select label="Construction site" name="site" value={form.site} onChange={update("site")} required>
        <option value="">Select a site</option>
        {reference.sites.map((site) => (
          <option key={site._id} value={site._id}>{site.dep_name}</option>
        ))}
      </Select>
      <Select label="Client" name="client" value={form.client} onChange={update("client")} hint="Optional for internal jobs.">
        <option value="">No client</option>
        {reference.clients.map((client) => (
          <option key={client._id} value={client._id}>
            {client.companyName || client.userId?.name || client.entityType}
          </option>
        ))}
      </Select>
      <Input label="Start date" name="startDate" type="date" value={form.startDate} onChange={update("startDate")} required />
      <Input label="Planned end date" name="endDate" type="date" value={form.endDate} onChange={update("endDate")} required />
      <div className="sm:col-span-2">
        <Textarea label="Scope and description" name="description" rows={3} value={form.description} onChange={update("description")} />
      </div>
      <Select label="Project manager" name="manager" value={form.manager} onChange={update("manager")}>
        <option value="">Unassigned</option>
        {reference.employees.map((employee) => (
          <option key={employee._id} value={employee._id}>
            {employee.userId?.name || employee.employeeId} · {employee.designation || "Team"}
          </option>
        ))}
      </Select>
      <Select label="Priority" name="priority" value={form.priority} onChange={update("priority")}>
        {["Low", "Normal", "High", "Critical"].map((priority) => (
          <option key={priority} value={priority}>{priority}</option>
        ))}
      </Select>
      <Select label="Delivery health" name="health" value={form.health} onChange={update("health")}>
        {["On Track", "At Risk", "Delayed", "On Hold"].map((health) => (
          <option key={health} value={health}>{health}</option>
        ))}
      </Select>
      <Input label="Physical progress (%)" name="progress" type="number" min="0" max="100" value={form.progress} onChange={update("progress")} />
      <Input label="Contract value (INR)" name="contractValue" type="number" min="0" step="0.01" value={form.contractValue} onChange={update("contractValue")} />
      <Input label="Estimated cost (INR)" name="estimatedCost" type="number" min="0" step="0.01" value={form.estimatedCost} onChange={update("estimatedCost")} />
      <div className="sm:col-span-2">
        <Input label="Tags" name="tags" value={form.tags} onChange={update("tags")} hint="Comma-separated, e.g. residential, phase-1." />
      </div>

      {reference.employees.length > 0 && (
        <div className="sm:col-span-2">
          <p className="mb-1.5 font-display text-xs font-semibold uppercase tracking-wider text-navy-700">
            Site team
          </p>
          <div className="grid grid-cols-1 gap-2 rounded-md border border-concrete-200 p-3 sm:grid-cols-2">
            {teamOptions.map((employee) => (
              <label key={employee._id} className="flex cursor-pointer items-start gap-2 rounded p-1.5 text-sm text-navy-800 hover:bg-concrete-50">
                <input
                  type="checkbox"
                  checked={form.team.includes(employee._id)}
                  onChange={() => toggleTeam(employee._id)}
                  className="mt-0.5 h-4 w-4 rounded border-concrete-300 accent-navy-900"
                />
                <span>
                  <span className="block font-medium">{employee.userId?.name || employee.employeeId}</span>
                  <span className="block text-xs text-concrete-500">{employee.designation || "Team member"}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {!reference.admin && (
        <div className="sm:col-span-2">
          <Alert variant="info">
            Site and team lists are managed by an administrator. Ask them to update the roster if a name is missing.
          </Alert>
        </div>
      )}
    </FormPage>
  );
};

export default ProjectForm;
