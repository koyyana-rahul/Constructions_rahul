import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LuClipboardList, LuFileText, LuPaperclip, LuCalendarDays } from "react-icons/lu";
import FormPage from "../ui/FormPage";
import { Input, Textarea } from "../ui/Form";
import { api, getErrorMessage } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { invalidate } from "../../hooks/useQuery";

const ALLOWED = [".pdf", ".doc", ".docx", ".txt", ".xlsx"];
const MAX_BYTES = 5 * 1024 * 1024;

const AddWork = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [request, setRequest] = useState({
    name: "",
    startDate: "",
    endDate: "",
    description: "",
  });
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (event) => {
    const {name, value} = event.target;
    setRequest((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
    setError(null);
  };

  const handleFileChange = (event) => {
    const selected = event.target.files?.[0];
    setErrors((prev) => ({ ...prev, document: undefined }));
    if (!selected) {
      setFile(null);
      return;
    }

    const extension = `.${selected.name.split(".").pop()?.toLowerCase()}`;
    if (!ALLOWED.includes(extension)) {
      setErrors((prev) => ({
        ...prev,
        document: `Only ${ALLOWED.join(", ").toUpperCase()} files are allowed`,
      }));
      setFile(null);
      return;
    }
    if (selected.size > MAX_BYTES) {
      setErrors((prev) => ({ ...prev, document: "File must be 5 MB or smaller" }));
      setFile(null);
      return;
    }
    setFile(selected);
  };

  const validate = () => {
    const next = {};
    if (!request.name.trim()) next.name = "Request name is required";
    else if (request.name.trim().length < 4)
      next.name = "Please describe the request in at least 4 characters";
    if (!request.startDate) next.startDate = "Start date is required";
    if (!request.endDate) next.endDate = "End date is required";
    if (request.startDate && request.endDate && request.endDate < request.startDate)
      next.endDate = "End date must be on or after the start date";
    if (!request.description.trim()) next.description = "Please describe the work required";
    else if (request.description.trim().length < 10)
      next.description = "Please add a little more detail (at least 10 characters)";

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setError(null);
    try {
      const payload = new FormData();
      payload.append("userId", user._id);
      payload.append("name", request.name);
      payload.append("startDate", request.startDate);
      payload.append("endDate", request.endDate);
      payload.append("description", request.description);
      if (file) payload.append("details", file);

      const { data } = await api.post("/work-request/add", payload);
      if (data.success) {
        invalidate(["work-requests", "client-dashboard", "dashboard-summary"]);
        navigate(`/client-dashboard/work/${user._id}`);
      }
    } catch (err) {
      setError(getErrorMessage(err, "Unable to submit your work request."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormPage
      title="New Work Request"
      description="Describe the work you need and attach any supporting drawings or documents."
      breadcrumbs={[
        { label: "Client Dashboard", to: "/client-dashboard" },
        { label: "Work Requests", to: `/client-dashboard/work/${user?._id}` },
      ]}
      backTo={`/client-dashboard/work/${user?._id}`}
      submitLabel="Submit request"
      submitting={submitting}
      error={error}
      onSubmit={handleSubmit}
      onCancel={() => navigate(`/client-dashboard/work/${user?._id}`)}
      footerExtra={
        <p className="mr-auto text-xs text-concrete-500">
          Your contractor reviews each request and sets its status.
        </p>
      }
    >
      <div className="sm:col-span-2">
        <Input
          label="Request name"
          name="name"
          placeholder="e.g. Second-floor slab pour — North wing"
          value={request.name}
          onChange={handleChange}
          error={errors.name}
          required
          icon={<LuClipboardList className="h-4 w-4" />}
        />
      </div>

      <Input
        label="Start date"
        name="startDate"
        type="date"
        value={request.startDate}
        onChange={handleChange}
        error={errors.startDate}
        required
        icon={<LuCalendarDays className="h-4 w-4" />}
      />
      <Input
        label="End date"
        name="endDate"
        type="date"
        min={request.startDate || undefined}
        value={request.endDate}
        onChange={handleChange}
        error={errors.endDate}
        required
        icon={<LuCalendarDays className="h-4 w-4" />}
      />

      <div className="sm:col-span-2">
        <Textarea
          label="Scope of work"
          name="description"
          rows={5}
          placeholder="Describe the work, materials, access requirements and any constraints"
          value={request.description}
          onChange={handleChange}
          error={errors.description}
          required
        />
      </div>

      <div className="sm:col-span-2">
        <span className="mb-1.5 block font-display text-xs font-semibold uppercase tracking-wider text-navy-700">
          Supporting document (optional)
        </span>
        <label
          htmlFor="document"
          className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-concrete-300 bg-white px-3 py-2 font-display text-xs font-semibold uppercase tracking-wide text-navy-800 transition-colors hover:border-navy-400 hover:bg-navy-50"
        >
          <LuPaperclip className="h-4 w-4" aria-hidden="true" />
          {file ? file.name : "Attach file"}
          <input
            id="document"
            type="file"
            accept=".pdf,.doc,.docx,.txt,.xlsx"
            onChange={handleFileChange}
            className="sr-only"
          />
        </label>
        <p className="mt-1.5 text-xs text-concrete-500">
          {ALLOWED.join(", ").toUpperCase()} up to 5 MB.
        </p>
        {errors.document && (
          <p role="alert" className="mt-1 text-xs text-danger-600">
            {errors.document}
          </p>
        )}
        {file && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-success-700">
            <LuFileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {file.name} ({(file.size / 1024).toFixed(0)} KB)
          </p>
        )}
      </div>
    </FormPage>
  );
};

export default AddWork;