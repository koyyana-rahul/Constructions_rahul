import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LuBuilding2 } from "react-icons/lu";
import FormPage from "../ui/FormPage";
import { Input, Textarea } from "../ui/Form";
import { PageLoader } from "../ui/Feedback";
import {
  useGetDepartmentQuery,
  useUpdateDepartmentMutation,
} from "../../services/api/endpoints/departmentsApi";
import { getErrorMessage } from "../../lib/api";

const EMPTY = { dep_name: "", description: "" };

const EditDepartment = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: site, isLoading: loading } = useGetDepartmentQuery(id, { skip: !id });
  const [updateDepartment, { isLoading: submitting }] = useUpdateDepartmentMutation();

  // Local copy seeded from the cached record: the admin can edit even while a
  // background refetch is in flight, and a fresh server value does not wipe
  // half-typed input.
  const [department, setDepartment] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (site && !seeded) {
      setDepartment({
        dep_name: site.dep_name || "",
        description: site.description || "",
      });
      setSeeded(true);
    }
  }, [site, seeded]);

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
      await updateDepartment({ id, ...department }).unwrap();
      navigate("/admin-dashboard/departments");
    } catch (err) {
      setError(getErrorMessage(err, "Unable to update the site."));
    }
  };

  if (loading) return <PageLoader label="Loading construction site" />;

  return (
    <FormPage
      title="Edit Construction Site"
      description="Update this site's name and description."
      breadcrumbs={[
        { label: "Admin", to: "/admin-dashboard" },
        { label: "Construction Sites", to: "/admin-dashboard/departments" },
      ]}
      backTo="/admin-dashboard/departments"
      submitLabel="Save changes"
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

export default EditDepartment;