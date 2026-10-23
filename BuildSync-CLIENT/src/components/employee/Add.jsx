import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LuUser,
  LuMail,
  LuHardHat,
  LuCake,
  LuAccessibility,
  LuHeartHandshake,
  LuBriefcase,
  LuBuilding2,
  LuBanknote,
  LuShieldCheck,
  LuImage,
  LuLink,
  LuCopy,
  LuCheck,
  LuClock,
  LuSend,
  LuArrowLeft,
  LuUserPlus,
} from "react-icons/lu";
import FormPage from "../ui/FormPage";
import { Input, Select } from "../ui/Form";
import Avatar from "../ui/Avatar";
import Button from "../ui/Button";
import { Alert } from "../ui/Feedback";
import { Card, CardBody } from "../ui/Card";
import PageHeader from "../ui/PageHeader";
import { useGetDepartmentsQuery } from "../../services/api/endpoints/departmentsApi";
import { useAddEmployeeMutation } from "../../services/api/endpoints/employeesApi";
import { getErrorMessage } from "../../lib/api";

const INITIAL = {
  name: "",
  email: "",
  employeeId: "",
  dob: "",
  gender: "",
  maritalStatus: "",
  designation: "",
  department: "",
  salary: "",
  role: "employee",
  image: null,
};

const AddEmployee = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [invitation, setInvitation] = useState(null);
  const [copied, setCopied] = useState(false);

  // The site list comes from the server, which already excludes archived
  // sites - so a new hire can never be assigned to a closed site.
  const { data: departments = [], isLoading: loadingSites } = useGetDepartmentsQuery();

  // The mutation invalidates Employees + Departments + Dashboard, so the
  // employee list, the site pickers and the dashboard counts all refresh.
  const [createEmployee, { isLoading: submitting }] = useAddEmployeeMutation();

  const handleChange = (event) => {
    const {name, value, files, type, checked} = event.target;
    if (name === "image") {
      const file = files?.[0] || null;
      setFormData((prev) => ({ ...prev, image: file }));
      setErrors((prev) => ({ ...prev, image: undefined }));
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
    setError(null);
  };

  const validate = () => {
    const next = {};

    if (!formData.name.trim()) next.name = "Name is required";
    if (!formData.email.trim()) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim()))
      next.email = "Enter a valid email address";

    if (!formData.employeeId.trim()) next.employeeId = "Employee ID is required";
    if (!formData.department) next.department = "Select a construction site";
    if (!formData.salary || Number(formData.salary) <= 0)
      next.salary = "Enter a salary greater than 0";

    if (formData.image && formData.image.size > 2 * 1024 * 1024)
      next.image = "Profile photo must be 2 MB or smaller";

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    setError(null);

    try {
      const payload = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (key !== "image" && value !== null && value !== undefined) {
          payload.append(key, value);
        }
      });
      if (formData.image) payload.append("image", formData.image);

      const result = await createEmployee(payload).unwrap();
      // Show the one-time activation link instead of navigating away.
      setInvitation(result);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to add the employee."));
    }
  };

  /**
   * Object URLs are a scarce browser resource - each one pins the blob in
   * memory until it is explicitly revoked. Memoising the URL means one is
   * created per selected file (not one per render), and the effect revokes
   * it when the file changes or the form unmounts.
   */
  const preview = useMemo(
    () => (formData.image ? URL.createObjectURL(formData.image) : null),
    [formData.image]
  );

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const activationUrl = invitation
    ? `${window.location.origin}${invitation.activation.url}`
    : "";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(activationUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  /* ---------------- Success: invitation issued ---------------- */
  if (invitation) {
    return (
      <>
        <PageHeader
          title="Invitation created"
          description={`${invitation.employee.email} can now set their own password.`}
          breadcrumbs={[
            { label: "Admin", to: "/admin-dashboard" },
            { label: "Employees", to: "/admin-dashboard/employees" },
            { label: "Invite" },
          ]}
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/admin-dashboard/employees")}
            >
              <LuArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to employees
            </Button>
          }
        />

        <div className="max-w-3xl space-y-5">
          <Alert
            variant={invitation.emailDelivery?.delivered ? "success" : "warning"}
          >
            {invitation.message}
          </Alert>

          <Card>
            <CardBody className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-navy-900 text-white">
                  <LuLink className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-navy-900">
                    Activation link — shown once
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-navy-700">
                    Send this link to {invitation.employee.email}. It lets them
                    choose their own password and can only be used once.
                  </p>

                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <code className="min-w-0 flex-1 truncate rounded-md border border-navy-200 bg-navy-50 px-3 py-2 font-mono text-xs text-navy-800">
                      {activationUrl}
                    </code>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={copyLink}
                      className="shrink-0"
                    >
                      {copied ? (
                        <LuCheck className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <LuCopy className="h-4 w-4" aria-hidden="true" />
                      )}
                      {copied ? "Copied" : "Copy link"}
                    </Button>
                  </div>

                  <p className="mt-3 flex items-center gap-1.5 text-xs text-navy-600">
                    <LuClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Expires{" "}
                    {new Date(invitation.activation.expiresAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>

          <Alert variant={invitation.emailDelivery?.delivered ? "info" : "warning"}>
            {invitation.emailDelivery?.delivered
              ? "The email was accepted by the mail provider. Keep this one-time link as a backup - if it is lost, use the resend action on the employees list."
              : "The email was not delivered. Share this one-time link manually. If it is lost, use the resend action on the employees list."}
          </Alert>

          <div className="flex flex-wrap gap-3">
            <Button variant="accent" onClick={() => navigate("/admin-dashboard/employees")}>
              <LuSend className="h-4 w-4" aria-hidden="true" />
              Done
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setInvitation(null);
                setFormData(INITIAL);
              }}
            >
              Invite another employee
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <FormPage
      title="Invite Employee"
      description="Add a team member and send them a one-time link to choose their own password."
      breadcrumbs={[
        { label: "Admin", to: "/admin-dashboard" },
        { label: "Employees", to: "/admin-dashboard/employees" },
      ]}
      backTo="/admin-dashboard/employees"
      submitLabel="Send invitation"
      submitting={submitting}
      error={error}
      onSubmit={handleSubmit}
      onCancel={() => navigate("/admin-dashboard/employees")}
      footerExtra={
        <p className="mr-auto text-xs text-concrete-500">
          Employee ID and email must be unique across the organisation.
        </p>
      }
    >
      <div className="sm:col-span-2">
        <div className="flex flex-wrap items-center gap-5 rounded-lg border border-concrete-200 bg-concrete-50 p-4">
          <Avatar src={preview} name={formData.name} size="lg" />
          <div className="min-w-[16rem] flex-1">
            <label
              htmlFor="image"
              className="mb-1.5 block font-display text-xs font-semibold uppercase tracking-wider text-navy-700"
            >
              Profile photo (optional)
            </label>
            <label
              htmlFor="image"
              className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-concrete-300 bg-white px-3 py-2 font-display text-xs font-semibold uppercase tracking-wide text-navy-800 transition-colors hover:border-navy-400 hover:bg-navy-50"
            >
              <LuImage className="h-4 w-4" aria-hidden="true" />
              Choose image
              <input
                id="image"
                name="image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleChange}
                className="sr-only"
              />
            </label>
            <p className="mt-1.5 text-xs text-concrete-500">JPG, PNG or WEBP up to 2 MB.</p>
            {errors.image && (
              <p role="alert" className="mt-1 text-xs text-danger-600">
                {errors.image}
              </p>
            )}
          </div>
        </div>
      </div>

      <Input
        label="Full name"
        name="name"
        placeholder="Employee name"
        value={formData.name}
        onChange={handleChange}
        error={errors.name}
        required
        icon={<LuUser className="h-4 w-4" />}
      />
      <Input
        label="Email address"
        name="email"
        type="email"
        placeholder="name@company.com"
        value={formData.email}
        onChange={handleChange}
        error={errors.email}
        required
        icon={<LuMail className="h-4 w-4" />}
      />
      <Input
        label="Employee ID"
        name="employeeId"
        placeholder="e.g. EMP-1042"
        value={formData.employeeId}
        onChange={handleChange}
        error={errors.employeeId}
        required
        icon={<LuHardHat className="h-4 w-4" />}
      />
      <Input
        label="Date of birth"
        name="dob"
        type="date"
        value={formData.dob}
        onChange={handleChange}
        error={errors.dob}
        icon={<LuCake className="h-4 w-4" />}
      />
      <Select
        label="Gender"
        name="gender"
        value={formData.gender}
        onChange={handleChange}
        error={errors.gender}
        icon={<LuAccessibility className="h-4 w-4" />}
      >
        <option value="">Select gender</option>
        <option value="male">Male</option>
        <option value="female">Female</option>
        <option value="other">Other</option>
      </Select>
      <Select
        label="Marital status"
        name="maritalStatus"
        value={formData.maritalStatus}
        onChange={handleChange}
        error={errors.maritalStatus}
        icon={<LuHeartHandshake className="h-4 w-4" />}
      >
        <option value="">Select status</option>
        <option value="single">Single</option>
        <option value="married">Married</option>
      </Select>
      <Input
        label="Designation"
        name="designation"
        placeholder="e.g. Site Supervisor"
        value={formData.designation}
        onChange={handleChange}
        error={errors.designation}
        icon={<LuBriefcase className="h-4 w-4" />}
      />
      <Select
        label="Construction site"
        name="department"
        value={formData.department}
        onChange={handleChange}
        error={errors.department}
        required
        disabled={loadingSites}
        hint={
          loadingSites
            ? "Loading sites…"
            : "Archived sites are not listed - a new hire cannot join a closed site."
        }
        icon={<LuBuilding2 className="h-4 w-4" />}
      >
        <option value="">{loadingSites ? "Loading sites…" : "Select a site"}</option>
        {departments.map((dep) => (
          <option key={dep._id} value={dep._id}>
            {dep.dep_name}
          </option>
        ))}
      </Select>
      <Input
        label="Monthly salary"
        name="salary"
        type="number"
        min="0"
        step="0.01"
        placeholder="0.00"
        value={formData.salary}
        onChange={handleChange}
        error={errors.salary}
        required
        icon={<LuBanknote className="h-4 w-4" />}
      />
      <Select
        label="Role"
        name="role"
        value={formData.role}
        onChange={handleChange}
        error={errors.role}
        hint="Controls which dashboard this person can access."
        icon={<LuShieldCheck className="h-4 w-4" />}
      >
        <option value="employee">Employee</option>
        <option value="admin">Administrator</option>
      </Select>
      <Alert variant="info" className="sm:col-span-2">
        <span className="flex items-start gap-2">
          <LuUserPlus className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            The account is created without a password. The employee receives a
            one-time invitation link and chooses their own password - you never
            see or store it.
          </span>
        </span>
      </Alert>
    </FormPage>
  );
};

export default AddEmployee;