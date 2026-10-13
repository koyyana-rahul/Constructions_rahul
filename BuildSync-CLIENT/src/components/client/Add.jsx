import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LuUser,
  LuMail,
  LuPhone,
  LuBuilding2,
  LuBriefcase,
  LuImage,
  LuUserPlus,
  LuCheck,
  LuCopy,
  LuLink,
  LuSend,
  LuClock,
  LuArrowLeft,
} from "react-icons/lu";
import FormPage from "../ui/FormPage";
import { Input, Select } from "../ui/Form";
import Avatar from "../ui/Avatar";
import Button from "../ui/Button";
import { Alert } from "../ui/Feedback";
import { Card, CardBody } from "../ui/Card";
import PageHeader from "../ui/PageHeader";
import { api, getErrorMessage } from "../../lib/api";

const AddClient = () => {
  const navigate = useNavigate();
  const [client, setClient] = useState({
    name: "",
    email: "",
    phone: "",
    companyName: "",
    entityType: "",
    image: null,
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [invitation, setInvitation] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleChange = (event) => {
    const { name, value, files } = event.target;
    if (name === "image") {
      const file = files?.[0] || null;
      setClient((prev) => ({ ...prev, image: file }));
      setErrors((prev) => ({ ...prev, image: undefined }));
      return;
    }
    setClient((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
    setError(null);
  };

  const validate = () => {
    const next = {};

    if (!client.name.trim()) next.name = "Contact name is required";
    else if (client.name.trim().length < 2)
      next.name = "Contact name must be at least 2 characters";

    if (!client.companyName.trim()) next.companyName = "Organisation name is required";
    else if (client.companyName.trim().length < 2)
      next.companyName = "Organisation name must be at least 2 characters";

    if (!client.email.trim()) next.email = "Email address is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.email.trim()))
      next.email = "Enter a valid email address";

    if (!client.phone.trim()) next.phone = "Phone number is required";
    else if (!/^\+?[0-9][0-9\s-]{6,19}$/.test(client.phone.trim()))
      next.phone = "Enter a valid phone number";

    if (!client.entityType) next.entityType = "Select an entity type";

    if (client.image && client.image.size > 2 * 1024 * 1024)
      next.image = "Logo must be 2 MB or smaller";

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setError(null);
    setFieldErrors([]);

    try {
      const payload = new FormData();
      payload.append("name", client.name.trim());
      payload.append("email", client.email.trim());
      payload.append("phone", client.phone.trim());
      payload.append("companyName", client.companyName.trim());
      payload.append("entityType", client.entityType);
      if (client.image) payload.append("image", client.image);

      const { data } = await api.post("/client/add", payload);
      if (data.success) {
        // Show the one-time activation link instead of navigating away.
        setInvitation(data);
      }
    } catch (err) {
      const serverFieldErrors = err?.response?.data?.errors;
      if (Array.isArray(serverFieldErrors) && serverFieldErrors.length) {
        const mapped = {};
        serverFieldErrors.forEach(({ field, message }) => {
          mapped[field] = message;
        });
        setErrors(mapped);
        setFieldErrors(Object.values(mapped));
      } else if (err?.response?.data?.code === "INVITATION_PENDING") {
        setError(
          "An invited account already exists for that email and has not been activated yet. Resend the invitation from the clients list."
        );
      } else {
        setError(getErrorMessage(err, "Unable to create the client invitation."));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const activationUrl = invitation
    ? `${window.location.origin}/activate?token=${invitation.activation.token}`
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
          description={`${invitation.client.email} can now set their own password.`}
          breadcrumbs={[
            { label: "Admin", to: "/admin-dashboard" },
            { label: "Clients", to: "/admin-dashboard/clients" },
            { label: "Invite" },
          ]}
          actions={
            <Button variant="outline" size="sm" onClick={() => navigate("/admin-dashboard/clients")}>
              <LuArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to clients
            </Button>
          }
        />

        <div className="max-w-3xl space-y-5">
          <Alert variant="success">{invitation.message}</Alert>

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
                    Send this link to {invitation.client.email}. It lets them choose their own
                    password and can only be used once.
                  </p>

                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <code className="min-w-0 flex-1 truncate rounded-md border border-navy-200 bg-navy-50 px-3 py-2 font-mono text-xs text-navy-800">
                      {activationUrl}
                    </code>
                    <Button type="button" variant="outline" onClick={copyLink} className="shrink-0">
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
                    Expires {new Date(invitation.activation.expiresAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>

          <Alert variant="info">
            No email service is configured, so this link must be delivered manually. If it is
            lost, use Resend invitation on the clients list to issue a new one.
          </Alert>

          <div className="flex flex-wrap gap-3">
            <Button variant="accent" onClick={() => navigate("/admin-dashboard/clients")}>
              <LuSend className="h-4 w-4" aria-hidden="true" />
              Done
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setInvitation(null);
                setClient({
                  name: "",
                  email: "",
                  phone: "",
                  companyName: "",
                  entityType: "",
                  image: null,
                });
              }}
            >
              Invite another client
            </Button>
          </div>
        </div>
      </>
    );
  }

  /* ---------------- Form ---------------- */
  const preview = client.image ? URL.createObjectURL(client.image) : null;

  return (
    <FormPage
      title="Invite Client"
      description="Create a client login and send them a one-time activation link. You never set their password."
      breadcrumbs={[
        { label: "Admin", to: "/admin-dashboard" },
        { label: "Clients", to: "/admin-dashboard/clients" },
      ]}
      backTo="/admin-dashboard/clients"
      submitLabel="Create invitation"
      submitting={submitting}
      error={error}
      onSubmit={handleSubmit}
      onCancel={() => navigate("/admin-dashboard/clients")}
      footerExtra={
        fieldErrors.length > 0 && (
          <p className="mr-auto text-xs text-danger-600">
            Fix {fieldErrors.length} highlighted field
            {fieldErrors.length === 1 ? "" : "s"} before continuing.
          </p>
        )
      }
    >
      <div className="sm:col-span-2">
        <div className="flex flex-wrap items-center gap-5 rounded-lg border border-concrete-200 bg-concrete-50 p-4">
          <Avatar src={preview} name={client.name} size="lg" />
          <div className="min-w-[16rem] flex-1">
            <label
              htmlFor="image"
              className="mb-1.5 block font-display text-xs font-semibold uppercase tracking-wider text-navy-700"
            >
              Logo or profile photo (optional)
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
        label="Contact name"
        name="name"
        placeholder="Full name of the primary contact"
        value={client.name}
        onChange={handleChange}
        error={errors.name}
        required
        icon={<LuUser className="h-4 w-4" />}
      />
      <Input
        label="Organisation name"
        name="companyName"
        placeholder="Company or individual name"
        value={client.companyName}
        onChange={handleChange}
        error={errors.companyName}
        required
        icon={<LuBuilding2 className="h-4 w-4" />}
      />
      <Input
        label="Email address"
        name="email"
        type="email"
        autoComplete="off"
        placeholder="contact@company.com"
        value={client.email}
        onChange={handleChange}
        error={errors.email}
        required
        hint="The activation link is sent to this address. Must be unique."
        icon={<LuMail className="h-4 w-4" />}
      />
      <Input
        label="Phone number"
        name="phone"
        type="tel"
        placeholder="+91 98765 43210"
        value={client.phone}
        onChange={handleChange}
        error={errors.phone}
        required
        icon={<LuPhone className="h-4 w-4" />}
      />
      <div className="sm:col-span-2">
        <Select
          label="Entity type"
          name="entityType"
          value={client.entityType}
          onChange={handleChange}
          error={errors.entityType}
          required
          hint="Determines how this client is recorded on work requests and reports."
          icon={<LuBriefcase className="h-4 w-4" />}
        >
          <option value="">Select an entity type</option>
          <option value="legal">Legal entity (registered business)</option>
          <option value="natural">Natural person (individual)</option>
        </Select>
      </div>

      <Alert variant="info" className="sm:col-span-2">
        <span className="flex items-start gap-2">
          <LuUserPlus className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            The account is created without a password. Your client receives a one-time link
            and chooses their own — you will never see or store their password.
          </span>
        </span>
      </Alert>
    </FormPage>
  );
};

export default AddClient;