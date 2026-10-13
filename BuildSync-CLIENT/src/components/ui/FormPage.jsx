import { useId } from "react";
import { Link } from "react-router-dom";
import { LuArrowLeft } from "react-icons/lu";
import PageHeader from "./PageHeader";
import { Card, CardFooter } from "./Card";
import Button from "./Button";
import { Alert } from "./Feedback";

/**
 * Standard form page: back navigation, breadcrumbs, a single responsive
 * content column and an action bar.
 *
 * This replaces the previous `max-w-3xl ... w-96` pattern, where the two
 * width classes conflicted - `max-w-3xl` is inert below 768px, so every form
 * was hard-locked to 384px wide on phones.
 */
const FormPage = ({
  title,
  description,
  breadcrumbs = [],
  backTo,
  submitLabel = "Save",
  submitting = false,
  error,
  onSubmit,
  onCancel,
  children,
  footerExtra,
  width = "md",
}) => {
  const formId = `form-${useId()}`;

  const widths = {
    sm: "max-w-2xl",
    md: "max-w-3xl",
    lg: "max-w-5xl",
  };

  const allCrumbs = backTo ? [...breadcrumbs, { label: title, to: backTo }] : breadcrumbs;

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        breadcrumbs={allCrumbs}
        actions={
          backTo ? (
            <Link to={backTo}>
              <Button variant="outline" size="sm">
                <LuArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back
              </Button>
            </Link>
          ) : null
        }
      />

      <div className={widths[width]}>
        <Alert variant="error" className="mb-4 sm:mb-5">
          {error}
        </Alert>

        <Card>
          <form id={formId} onSubmit={onSubmit} noValidate className="p-5 sm:p-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">{children}</div>
          </form>

          <CardFooter>
            {footerExtra}
            {onCancel && (
              <Button variant="outline" onClick={onCancel} disabled={submitting}>
                Cancel
              </Button>
            )}
            {/* `form` attribute associates this button with the form above,
                so native constraint validation and submit events still fire. */}
            <Button
              type="submit"
              form={formId}
              variant="accent"
              loading={submitting}
            >
              {submitting ? "Saving" : submitLabel}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </>
  );
};

export default FormPage;