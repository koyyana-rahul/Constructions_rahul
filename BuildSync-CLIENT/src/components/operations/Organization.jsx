import { useEffect, useMemo, useState } from "react";
import {
  LuBuilding2,
  LuCheckCircle2,
  LuFileText,
  LuGlobe,
  LuHash,
  LuMail,
  LuMapPin,
  LuPhone,
  LuRefreshCw,
  LuSave,
} from "react-icons/lu";
import PageHeader from "../../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { Alert, CardSkeleton, PermissionDenied } from "../../components/ui/Feedback";
import { Input, Select, Textarea } from "../../components/ui/Form";
import { getErrorMessage, isPermissionError } from "../../lib/api";
import {
  useGetNextNumbersQuery,
  useGetOrganizationQuery,
  useUpdateOrganizationMutation,
} from "../../services/api/endpoints/platformApi";

const EMPTY_FORM = {
  name: "",
  legalName: "",
  email: "",
  phone: "",
  website: "",
  address: "",
  gstin: "",
  logo: "",
  currency: "INR",
  taxRate: 18,
  invoicePrefix: "INV",
  projectPrefix: "PRJ",
  invoiceTerms: "Payment due within 30 days of the invoice date.",
};

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "AUD", "CAD", "SGD"];

const Organization = () => {
  const { data: organization, isLoading, error, refetch } = useGetOrganizationQuery();
  const nextNumbersQuery = useGetNextNumbersQuery(undefined, {
    skip: Boolean(error),
  });
  const [updateOrganization, updateState] = useUpdateOrganizationMutation();

  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!organization) return;
    setForm({
      name: organization.name || "",
      legalName: organization.legalName || "",
      email: organization.email || "",
      phone: organization.phone || "",
      website: organization.website || "",
      address: organization.address || "",
      gstin: organization.gstin || "",
      logo: organization.logo || "",
      currency: organization.currency || "INR",
      taxRate: organization.taxRate ?? 18,
      invoicePrefix: organization.invoicePrefix || "INV",
      projectPrefix: organization.projectPrefix || "PRJ",
      invoiceTerms: organization.invoiceTerms || "",
    });
  }, [organization]);

  const changed = useMemo(() => {
    if (!organization) return false;
    return Object.keys(EMPTY_FORM).some(
      (key) => String(form[key] ?? "") !== String(organization[key] ?? "")
    );
  }, [form, organization]);

  const update = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const onSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    setNotice("");
    if (!form.name.trim()) {
      setFormError("Enter the company name used on invoices and reports.");
      return;
    }
    try {
      await updateOrganization({
        ...form,
        name: form.name.trim(),
        taxRate: Number(form.taxRate),
        invoicePrefix: form.invoicePrefix.trim().toUpperCase(),
        projectPrefix: form.projectPrefix.trim().toUpperCase(),
      }).unwrap();
      setNotice("Organization profile saved. New invoices and projects will use the updated settings.");
      nextNumbersQuery.refetch();
    } catch (saveError) {
      setFormError(getErrorMessage(saveError, "The company profile could not be saved."));
    }
  };

  if (isLoading) {
    return (
      <>
        <PageHeader title="Organization" description="Loading company profile" />
        <CardSkeleton count={3} />
      </>
    );
  }

  if (isPermissionError(error)) {
    return (
      <>
        <PageHeader title="Organization" />
        <Card><PermissionDenied /></Card>
      </>
    );
  }

  if (error && !organization) {
    return (
      <>
        <PageHeader title="Organization" />
        <Alert variant="error">{getErrorMessage(error, "Could not load the company profile.")}</Alert>
        <div className="mt-4">
          <Button variant="outline" onClick={refetch}>
            <LuRefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Organization"
        description="The company identity, tax defaults and document numbering used on invoices, reports and exports."
        actions={
          <Button
            variant="accent"
            type="submit"
            form="organization-form"
            loading={updateState.isLoading}
            disabled={!changed || updateState.isLoading}
          >
            <LuSave className="h-4 w-4" aria-hidden="true" /> Save changes
          </Button>
        }
      />

      {formError && (
        <div className="mb-4">
          <Alert variant="error" onDismiss={() => setFormError("")}>{formError}</Alert>
        </div>
      )}
      {notice && (
        <div className="mb-4">
          <Alert variant="success" onDismiss={() => setNotice("")}>{notice}</Alert>
        </div>
      )}

      <form id="organization-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader
              title="Company profile"
              description="Shown on invoices, printed documents and the assistant's introduction."
            />
            <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Trading name"
                name="organizationName"
                value={form.name}
                onChange={update("name")}
                required
                hint="Used across the application and on documents."
              />
              <Input
                label="Legal entity name"
                name="legalName"
                value={form.legalName}
                onChange={update("legalName")}
                hint="Optional registered name."
              />
              <Input
                label="Email"
                name="organizationEmail"
                type="email"
                value={form.email}
                onChange={update("email")}
                icon={<LuMail className="h-4 w-4" aria-hidden="true" />}
              />
              <Input
                label="Phone"
                name="organizationPhone"
                value={form.phone}
                onChange={update("phone")}
                icon={<LuPhone className="h-4 w-4" aria-hidden="true" />}
              />
              <Input
                label="Website"
                name="website"
                value={form.website}
                onChange={update("website")}
                placeholder="https://"
                icon={<LuGlobe className="h-4 w-4" aria-hidden="true" />}
              />
              <Input
                label="GSTIN"
                name="gstin"
                value={form.gstin}
                onChange={update("gstin")}
                hint="Printed on tax invoices."
              />
              <div className="sm:col-span-2">
                <Textarea
                  label="Registered address"
                  name="organizationAddress"
                  rows={3}
                  value={form.address}
                  onChange={update("address")}
                  placeholder="Street, city, state, postal code"
                />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Billing defaults"
              description="Applied to newly created invoices and projects. Existing documents keep their original numbers."
            />
            <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select label="Currency" name="currency" value={form.currency} onChange={update("currency")}>
                {CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>{currency}</option>
                ))}
              </Select>
              <Input
                label="Default tax rate (%)"
                name="taxRate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.taxRate}
                onChange={update("taxRate")}
              />
              <Input
                label="Invoice prefix"
                name="invoicePrefix"
                value={form.invoicePrefix}
                onChange={update("invoicePrefix")}
                maxLength={10}
                hint="Letters and digits only, up to 10 characters."
                icon={<LuFileText className="h-4 w-4" aria-hidden="true" />}
              />
              <Input
                label="Project prefix"
                name="projectPrefix"
                value={form.projectPrefix}
                onChange={update("projectPrefix")}
                maxLength={10}
                hint="Used when the next project code is generated."
                icon={<LuHash className="h-4 w-4" aria-hidden="true" />}
              />
              <div className="sm:col-span-2">
                <Textarea
                  label="Invoice terms"
                  name="invoiceTerms"
                  rows={4}
                  value={form.invoiceTerms}
                  onChange={update("invoiceTerms")}
                  hint="Printed at the bottom of every invoice."
                />
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Document numbering" description="The next numbers that will be issued." />
            <CardBody className="space-y-3">
              {nextNumbersQuery.isLoading ? (
                <p className="text-sm text-concrete-500">Loading counters…</p>
              ) : nextNumbersQuery.data ? (
                <>
                  {[
                    ["Next invoice", nextNumbersQuery.data.invoice],
                    ["Next project", nextNumbersQuery.data.project],
                    ["Next material", nextNumbersQuery.data.material],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-3 rounded-md bg-concrete-50 px-3 py-2.5">
                      <span className="text-xs text-concrete-500">{label}</span>
                      <span className="font-mono text-sm font-semibold text-navy-900">{value}</span>
                    </div>
                  ))}
                  <p className="text-xs leading-relaxed text-concrete-500">
                    Counters advance atomically when a document is created. They can never be set backwards.
                  </p>
                </>
              ) : (
                <p className="text-sm text-concrete-500">
                  Numbering preview is unavailable. Save the profile and refresh.
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="At a glance" description="How this profile will appear." />
            <CardBody className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-navy-50 text-navy-700">
                  <LuBuilding2 className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="font-display text-base font-semibold text-navy-900 break-words">
                    {form.name || "Your company"}
                  </p>
                  <p className="text-xs text-concrete-500 break-words">
                    {form.legalName || "Legal name not set"}
                  </p>
                  {form.gstin && (
                    <p className="mt-1 font-mono text-2xs uppercase tracking-wide text-concrete-500">
                      GSTIN {form.gstin}
                    </p>
                  )}
                </div>
              </div>

              <dl className="space-y-2.5 border-t border-concrete-100 pt-3 text-sm">
                <div className="flex items-start gap-2">
                  <LuMail className="mt-0.5 h-4 w-4 shrink-0 text-concrete-400" aria-hidden="true" />
                  <dd className="min-w-0 break-words text-concrete-600">{form.email || "No email set"}</dd>
                </div>
                <div className="flex items-start gap-2">
                  <LuPhone className="mt-0.5 h-4 w-4 shrink-0 text-concrete-400" aria-hidden="true" />
                  <dd className="min-w-0 break-words text-concrete-600">{form.phone || "No phone set"}</dd>
                </div>
                <div className="flex items-start gap-2">
                  <LuMapPin className="mt-0.5 h-4 w-4 shrink-0 text-concrete-400" aria-hidden="true" />
                  <dd className="min-w-0 break-words text-concrete-600">{form.address || "No address set"}</dd>
                </div>
              </dl>

              <div className="flex flex-wrap gap-2 border-t border-concrete-100 pt-3">
                <Badge tone="navy">{form.currency}</Badge>
                <Badge tone="accent">Tax {form.taxRate || 0}%</Badge>
                <Badge tone="neutral">Invoices {form.invoicePrefix || "—"}</Badge>
                <Badge tone="neutral">Projects {form.projectPrefix || "—"}</Badge>
              </div>
            </CardBody>
          </Card>

          <Card className="border-success-500/30 bg-success-50/40">
            <CardBody className="flex items-start gap-2.5 text-sm text-success-700">
              <LuCheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-600" aria-hidden="true" />
              <p className="leading-relaxed">
                Changes are audit-logged with the administrator&apos;s identity and the fields that changed.
              </p>
            </CardBody>
          </Card>
        </div>
      </form>
    </>
  );
};

export default Organization;
