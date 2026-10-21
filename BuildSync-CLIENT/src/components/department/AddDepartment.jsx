import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LuBuilding2 } from "react-icons/lu";
import FormPage from "../ui/FormPage";
import { Input, Textarea } from "../ui/Form";
import { useAddDepartmentMutation } from "../../services/api/endpoints/departmentsApi";
import { getErrorMessage } from "../../lib/api";

const AddDepartment = () => {
  const navigate = useNavigate();
  const [department, setDepartment] = useState({ dep_name: "", description: "" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);

  // The mutation invalidates Departments + Dashboard, so the site list and the
  // admin counts are current the moment the page navigates away.
  const [createDepartment, { isLoading: submitting }] = useAddDepartmentMutation();

  const handleChange = (event) => {
    const {name, value} = event.target;
    setDepartment((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
    setError(null);
  };

  const validate = () => {
    const next = {};
    if (!department.dep_name.trim()) next.dep_name = "Site name is required";
    else if (department.dep_name.trim().length < 2)
      next.dep_name = "Site name must be at least 2 characters";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    setError(null);
    try {
      await createDepartment(department).unwrap();
      navigate("/admin-dashboard/departments");
    } catch (err) {
      setError(getErrorMessage(err, "Unable to create the site."));
    }
  };

  return (
    <FormPage
      title="Add Construction Site"
      description="Create a site record so employees and work requests can be assigned to it."
      breadcrumbs={[
        { label: "Admin", to: "/admin-dashboard" },
        { label: "Construction Sites", to: "/admin-dashboard/departments" },
      ]}
      backTo="/admin-dashboard/departments"
      submitLabel="Create site"
      submitting={submitting}
      error={error}
      onSubmit={handleSubmit}
      onCancel={() => navigate("/admin-dashboard/departments")}
    >
      <div className="sm:col-span-2">
        <Input
          label="Site name"
          name="dep_name"
          placeholder="e.g. Riverside Tower — Phase 2"
          value={department.dep_name}
          onChange={handleChange}
          error={errors.dep_name}
          required
          icon={<LuBuilding2 className="h-4 w-4" />}
        />
      </div>

      <div className="sm:col-span-2">
        <Textarea
          label="Description"
          name="description"
          placeholder="Scope, location and any notes for this site"
          value={department.description}
          onChange={handleChange}
          hint="Optional. Helps your team identify the site at a glance."
        />
      </div>
    </FormPage>
  );
};

export default AddDepartment;