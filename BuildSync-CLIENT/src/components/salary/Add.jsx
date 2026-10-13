import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LuBuilding2,
  LuHardHat,
  LuBanknote,
  LuPlus,
  LuMinus,
  LuCalendarDays,
  LuWallet,
} from "react-icons/lu";
import FormPage from "../ui/FormPage";
import { Input, Select } from "../ui/Form";
import { api, getErrorMessage } from "../../lib/api";
import { fetchDepartments, getEmployees } from "../../utils/EmployeeHelper";
import { invalidate } from "../../hooks/useQuery";
import { formatINR } from "../../utils/format";

const AddSalary = () => {
  const navigate = useNavigate();

  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [salary, setSalary] = useState({
    department: "",
    employeeId: "",
    basicSalary: "",
    allowances: "",
    deductions: "",
    payDate: "",
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  useEffect(() => {
    fetchDepartments().then(setDepartments);
  }, []);

  const loadEmployees = useCallback(async (departmentId) => {
    if (!departmentId) {
      setEmployees([]);
      return;
    }
    setLoadingEmployees(true);
    setEmployees(await getEmployees(departmentId));
    setLoadingEmployees(false);
  }, []);

  const handleChange = (event) => {
    const {name, value} = event.target;
    setSalary((prev) => ({ ...prev, [name]: value, ...(name === "department" ? { employeeId: "" } : {}) }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
    setError(null);
    if (name === "department") loadEmployees(value);
  };

  const net = useMemo(() => {
    const basic = Number(salary.basicSalary) || 0;
    const allowances = Number(salary.allowances) || 0;
    const deductions = Number(salary.deductions) || 0;
    return basic + allowances - deductions;
  }, [salary.basicSalary, salary.allowances, salary.deductions]);

  const validate = () => {
    const next = {};
    if (!salary.department) next.department = "Select a construction site";
    if (!salary.employeeId) next.employeeId = "Select an employee";
    if (!salary.basicSalary || Number(salary.basicSalary) <= 0)
      next.basicSalary = "Enter a basic salary greater than 0";
    if (salary.allowances === "" || Number(salary.allowances) < 0)
      next.allowances = "Enter 0 or a positive amount";
    if (salary.deductions === "" || Number(salary.deductions) < 0)
      next.deductions = "Enter 0 or a positive amount";
    if (net < 0) next.deductions = "Deductions cannot exceed basic salary plus allowances";
    if (!salary.payDate) next.payDate = "Pay date is required";

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setError(null);
    try {
      const { data } = await api.post("/salary/add", salary);
      if (data.success) {
        invalidate(["salary", "dashboard-summary"]);
        navigate("/admin-dashboard/employees");
      }
    } catch (err) {
      setError(getErrorMessage(err, "Unable to process payroll."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormPage
      title="Process Payroll"
      description="Record a salary entry for an employee assigned to one of your sites."
      breadcrumbs={[{ label: "Admin", to: "/admin-dashboard" }, { label: "Salary" }]}
      backTo="/admin-dashboard/employees"
      submitLabel="Save salary entry"
      submitting={submitting}
      error={error}
      onSubmit={handleSubmit}
      onCancel={() => navigate("/admin-dashboard/employees")}
      footerExtra={
        <p className="mr-auto text-xs text-concrete-500">
          Employees sign in to review their own salary records.
        </p>
      }
    >
      <Select
        label="Construction site"
        name="department"
        value={salary.department}
        onChange={handleChange}
        error={errors.department}
        required
        icon={<LuBuilding2 className="h-4 w-4" />}
      >
        <option value="">Select a site</option>
        {departments.map((dep) => (
          <option key={dep._id} value={dep._id}>
            {dep.dep_name}
          </option>
        ))}
      </Select>

      <Select
        label="Employee"
        name="employeeId"
        value={salary.employeeId}
        onChange={handleChange}
        error={errors.employeeId}
        disabled={!salary.department || loadingEmployees}
        required
        hint={
          !salary.department
            ? "Select a construction site first."
            : loadingEmployees
            ? "Loading employees…"
            : undefined
        }
        icon={<LuHardHat className="h-4 w-4" />}
      >
        <option value="">
          {loadingEmployees ? "Loading…" : salary.department ? "Select an employee" : "—"}
        </option>
        {employees.map((employee) => (
          <option key={employee._id} value={employee._id}>
            {employee.employeeId} — {employee.userId?.name}
          </option>
        ))}
      </Select>

      <Input
        label="Basic salary"
        name="basicSalary"
        type="number"
        min="0"
        step="0.01"
        value={salary.basicSalary}
        onChange={handleChange}
        error={errors.basicSalary}
        required
        icon={<LuBanknote className="h-4 w-4" />}
      />
      <Input
        label="Allowances"
        name="allowances"
        type="number"
        min="0"
        step="0.01"
        value={salary.allowances}
        onChange={handleChange}
        error={errors.allowances}
        required
        icon={<LuPlus className="h-4 w-4" />}
      />
      <Input
        label="Deductions"
        name="deductions"
        type="number"
        min="0"
        step="0.01"
        value={salary.deductions}
        onChange={handleChange}
        error={errors.deductions}
        required
        icon={<LuMinus className="h-4 w-4" />}
      />
      <Input
        label="Pay date"
        name="payDate"
        type="date"
        value={salary.payDate}
        onChange={handleChange}
        error={errors.payDate}
        required
        icon={<LuCalendarDays className="h-4 w-4" />}
      />

      <div className="sm:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-navy-200 bg-navy-50 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <LuWallet className="h-5 w-5 text-navy-700" aria-hidden="true" />
            <span className="font-display text-sm font-semibold uppercase tracking-wide text-navy-800">
              Net salary
            </span>
          </div>
          <span
            className={`font-display text-2xl font-semibold tabular-nums ${
              net < 0 ? "text-danger-700" : "text-navy-900"
            }`}
          >
            {formatINR(net, 2)}
          </span>
        </div>
      </div>
    </FormPage>
  );
};

export default AddSalary;