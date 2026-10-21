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
  LuLock,
  LuShieldCheck,
  LuImage,
} from "react-icons/lu";
import FormPage from "../ui/FormPage";
import { Input, Select } from "../ui/Form";
import Avatar from "../ui/Avatar";
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
  password: "",
  role: "employee",
  image: null,
};

const AddEmployee = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);

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

    if (!formData.password) next.password = "Password is required";
    else if (formData.password.length < 6)
      next.password = "Password must be at least 6 characters";

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

      await createEmployee(payload).unwrap();
      navigate("/admin-dashboard/employees");
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

  return (
    <FormPage
      title="Add Employee"
      description="Register a new team member and assign them to a construction site."
      breadcrumbs={[
        { label: "Admin", to: "/admin-dashboard" },
        { label: "Employees", to: "/admin-dashboard/employees" },
      ]}
      backTo="/admin-dashboard/employees"
      submitLabel="Add employee"
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
      <div className="sm:col-span-2">
        <Input
          label="Temporary password"
          name="password"
          type="password"
          placeholder="Minimum 6 characters"
          value={formData.password}
          onChange={handleChange}
          error={errors.password}
          required
          hint="The employee can change this from Settings after signing in."
          icon={<LuLock className="h-4 w-4" />}
        />
      </div>
    </FormPage>
  );
};

export default AddEmployee;