import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LuUser, LuMail, LuPhone, LuBuilding2 } from "react-icons/lu";
import FormPage from "../ui/FormPage";
import { Input, Select } from "../ui/Form";
import { PageLoader } from "../ui/Feedback";
import { api, getErrorMessage } from "../../lib/api";

const EditClient = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [client, setClient] = useState({
    name: "",
    email: "",
    phone: "",
    entityType: "",
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/client/${id}`);
        if (data.success && data.client) {
          const record = data.client;
          setClient({
            name: record.userId?.name || "",
            email: record.userId?.email || "",
            phone: record.phone || "",
            entityType: record.entityType || "",
          });
        } else {
          setError("Client record not found.");
        }
      } catch (err) {
        setError(getErrorMessage(err, "Unable to load the client record."));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  const handleChange = (event) => {
    const {name, value} = event.target;
    setClient((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
    setError(null);
  };

  const validate = () => {
    const next = {};
    if (!client.name.trim()) next.name = "Name is required";
    if (!client.email.trim()) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.email.trim()))
      next.email = "Enter a valid email address";
    if (!client.entityType) next.entityType = "Select an entity type";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setError(null);
    try {
      const { data } = await api.put(`/client/${id}`, client);
      if (data.success) navigate(`/admin-dashboard/clients/${id}`);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to update the client."));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <PageLoader label="Loading client record" />;

  return (
    <FormPage
      title="Edit Client"
      description="Update this client's contact details and entity type."
      breadcrumbs={[
        { label: "Admin", to: "/admin-dashboard" },
        { label: "Clients", to: "/admin-dashboard/clients" },
      ]}
      backTo="/admin-dashboard/clients"
      submitLabel="Save changes"
      submitting={submitting}
      error={error}
      onSubmit={handleSubmit}
      onCancel={() => navigate("/admin-dashboard/clients")}
    >
      <Input
        label="Contact name"
        name="name"
        value={client.name}
        onChange={handleChange}
        error={errors.name}
        required
        icon={<LuUser className="h-4 w-4" />}
      />
      <Input
        label="Email address"
        name="email"
        type="email"
        value={client.email}
        onChange={handleChange}
        error={errors.email}
        required
        icon={<LuMail className="h-4 w-4" />}
      />
      <Input
        label="Phone number"
        name="phone"
        type="tel"
        value={client.phone}
        onChange={handleChange}
        error={errors.phone}
        icon={<LuPhone className="h-4 w-4" />}
      />
      <Select
        label="Entity type"
        name="entityType"
        value={client.entityType}
        onChange={handleChange}
        error={errors.entityType}
        required
        icon={<LuBuilding2 className="h-4 w-4" />}
      >
        <option value="natural">Natural person</option>
        <option value="legal">Legal entity</option>
      </Select>
    </FormPage>
  );
};

export default EditClient;