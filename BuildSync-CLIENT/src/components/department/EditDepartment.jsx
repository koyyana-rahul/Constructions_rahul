import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LuBuilding2 } from "react-icons/lu";
import FormPage from "../ui/FormPage";
import { Input, Textarea } from "../ui/Form";
import { PageLoader } from "../ui/Feedback";
import { api, getErrorMessage } from "../../lib/api";

const EditDepartment = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // The previous version initialised this to `[]`, so the first render read
  // `department.dep_name` off an array and rendered blank until data arrived.
  const [department, setDepartment] = useState({
    dep_name: "",
    description: "",
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/department/${id}`);
        if (data.success && data.department) {
          setDepartment({
            dep_name: data.department.dep_name || "",
            description: data.department.description || "",
          });
        } else {
          setError("Construction site not found.");
        }
      } catch (err) {
        setError(getErrorMessage(err, "Unable to load the construction site."));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

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

    setSubmitting(true);
    setError(null);
    try {
      const { data } = await api.put(`/department/${id}`, department);
      if (data.success) navigate("/admin-dashboard/departments");
    } catch (err) {
      setError(getErrorMessage(err, "Unable to update the site."));
    } finally {
      setSubmitting(false);
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