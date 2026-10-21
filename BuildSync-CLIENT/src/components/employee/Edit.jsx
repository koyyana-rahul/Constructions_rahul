import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LuUser, LuHeartHandshake, LuBriefcase, LuBuilding2, LuBanknote } from "react-icons/lu";
import FormPage from "../ui/FormPage";
import { Input, Select } from "../ui/Form";
import { PageLoader } from "../ui/Feedback";
import {
  useGetEmployeeQuery,
  useUpdateEmployeeMutation,
} from "../../services/api/endpoints/employeesApi";
import { useGetDepartmentsQuery } from "../../services/api/endpoints/departmentsApi";
import { getErrorMessage } from "../../lib/api";

const EditEmployee = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [employee, setEmployee] = useState({
    name: "",
    maritalStatus: "",
    designation: "",
    salary: "",
    department: "",
  });
  const [seeded, setSeeded] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);

  // The site list comes from the server and already excludes archived sites.
  const { data: departments = [], isLoading: loadingSites } = useGetDepartmentsQuery();

  const {
    data: record,
    error: loadError,
    isLoading: loading,
  } = useGetEmployeeQuery(id, { skip: !id });

  const [updateEmployee, { isLoading: submitting }] = useUpdateEmployeeMutation();

  /**
   * Seed the form once the record arrives.
   *
   * `department` comes back populated as an object; the update endpoint
   * expects the raw id.
   *
   * The `seeded` guard matters: RTK Query can refetch the record in the
   * background (focus, reconnect). Re-seeding on every refetch would wipe
   * whatever the administrator had already typed.
   */
  useEffect(() => {
    if (!record || seeded) return;
    setSeeded(true);
    setEmployee({
      name: record.userId?.name || "",
      maritalStatus: record.maritalStatus || "",
      designation: record.designation || "",
      salary: record.salary ?? "",
      department:
        typeof record.department === "object" && record.department !== null
          ? record.department._id
          : record.department || "",
    });
  }, [record, seeded]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setEmployee((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
    setError(null);
  };

  const validate = () => {
    const next = {};
    if (!employee.name.trim()) next.name = "Name is required";
    if (!employee.department) next.department = "Select a construction site";
    if (employee.salary === "" || Number(employee.salary) <= 0)
      next.salary = "Enter a salary greater than 0";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    setError(null);
    try {
      await updateEmployee({ id, ...employee }).unwrap();
      navigate(`/admin-dashboard/employees/${id}`);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to update the employee."));
    }
  };

  if (loading) return <PageLoader label="Loading employee record" />;

  return (
    <FormPage
      title="Edit Employee"
      description="Update this team member's site assignment, designation and salary."
      breadcrumbs={[
        { label: "Admin", to: "/admin-dashboard" },
        { label: "Employees", to: "/admin-dashboard/employees" },
      ]}
      backTo="/admin-dashboard/employees"
      submitLabel="Save changes"
      submitting={submitting}
      error={error || (loadError ? getErrorMessage(loadError) : null)}
      onSubmit={handleSubmit}
      onCancel={() => navigate("/admin-dashboard/employees")}
    >
      <Input
        label="Full name"
        name="name"
        value={employee.name}
        onChange={handleChange}
        error={errors.name}
        required
        icon={<LuUser className="h-4 w-4" />}
      />
      <Select
        label="Marital status"
        name="maritalStatus"
        value={employee.maritalStatus}
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
        value={employee.designation}
        onChange={handleChange}
        error={errors.designation}
        icon={<LuBriefcase className="h-4 w-4" />}
      />
      <Select
        label="Construction site"
        name="department"
        value={employee.department}
        onChange={handleChange}
        error={errors.department}
        required
        disabled={loadingSites}
        icon={<LuBuilding2 className="h-4 w-4" />}
      >
        <option value="">{loadingSites ? "Loading sites…" : "Select a site"}</option>
        {departments.map((dep) => (
          <option key={dep._id} value={dep._id}>
            {dep.dep_name}
          </option>
        ))}
      </Select>
      <div className="sm:col-span-2">
        <Input
          label="Monthly salary"
          name="salary"
          type="number"
          min="0"
          step="0.01"
          value={employee.salary}
          onChange={handleChange}
          error={errors.salary}
          required
          icon={<LuBanknote className="h-4 w-4" />}
        />
      </div>
    </FormPage>
  );
};

export default EditEmployee;
