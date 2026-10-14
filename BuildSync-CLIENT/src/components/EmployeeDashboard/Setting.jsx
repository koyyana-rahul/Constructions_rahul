import { useState } from "react";
import { LuLock, LuShieldCheck, LuInfo } from "react-icons/lu";
import PageHeader from "../ui/PageHeader";
import { Card, CardHeader, CardBody, CardFooter } from "../ui/Card";
import { Input } from "../ui/Form";
import Button from "../ui/Button";
import { Alert } from "../ui/Feedback";
import { getErrorMessage } from "../../lib/api";
import { useChangePasswordMutation } from "../../services/api/endpoints/settingsApi";
import { useCurrentUser } from "../../features/auth/useSession";
import { selectHomePath } from "../../features/auth/authSelectors";
import { useAppSelector } from "../../app/hooks";

/**
 * Shared change-password form.
 *
 * The two previous copies declared `userId: user._id` in the payload but then
 * navigated to `/admin-dashboard/employees` on success regardless of role, so
 * an employee saving their password was thrown into the admin employee list.
 * The destination now comes from the single `selectHomePath` selector that
 * also drives the post-login redirect, so the two can never disagree.
 *
 * `confirmPassword` is validated locally and never sent; the payload carries
 * only the two fields the server actually reads.
 */
const ChangePassword = () => {
  const user = useCurrentUser();
  const homePath = useAppSelector(selectHomePath);
  const [changePassword, { isLoading: submitting }] = useChangePasswordMutation();

  const [form, setForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const handleChange = (event) => {
    const {name, value} = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
    setError(null);
  };

  const validate = () => {
    const next = {};
    if (!form.oldPassword) next.oldPassword = "Enter your current password";
    if (!form.newPassword) next.newPassword = "Enter a new password";
    else if (form.newPassword.length < 6)
      next.newPassword = "Password must be at least 6 characters";
    else if (form.newPassword === form.oldPassword)
      next.newPassword = "New password must be different from your current password";
    if (!form.confirmPassword) next.confirmPassword = "Confirm your new password";
    else if (form.confirmPassword !== form.newPassword)
      next.confirmPassword = "Passwords do not match";

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    setError(null);
    setNotice(null);
    try {
      await changePassword({
        oldPassword: form.oldPassword,
        newPassword: form.newPassword,
      }).unwrap();
      setNotice("Password updated successfully.");
      // The confirmation field is cleared too, so the form cannot be resubmitted
      // with a stale match against a now-blank new password.
      setForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setError(getErrorMessage(err, "Unable to update your password."));
    }
  };

  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage your account security and preferences."
        breadcrumbs={[
          { label: "Dashboard", to: homePath },
          { label: "Settings" },
        ]}
      />

      <Alert variant="error" className="mb-4 sm:mb-5" onDismiss={() => setError(null)}>
        {error}
      </Alert>
      <Alert variant="success" className="mb-4 sm:mb-5" onDismiss={() => setNotice(null)}>
        {notice}
      </Alert>

      <div className="max-w-2xl">
        <Card>
          <CardHeader
            title="Change Password"
            description="Choose a password you do not use on any other site."
            actions={
              <LuShieldCheck className="h-5 w-5 text-concrete-400" aria-hidden="true" />
            }
          />
          <form onSubmit={handleSubmit} noValidate>
            <CardBody className="space-y-5">
              <Input
                label="Current password"
                name="oldPassword"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your current password"
                value={form.oldPassword}
                onChange={handleChange}
                error={errors.oldPassword}
                required
                icon={<LuLock className="h-4 w-4" />}
              />
              <Input
                label="New password"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                placeholder="Minimum 6 characters"
                value={form.newPassword}
                onChange={handleChange}
                error={errors.newPassword}
                required
                icon={<LuLock className="h-4 w-4" />}
              />
              <Input
                label="Confirm new password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder="Re-enter your new password"
                value={form.confirmPassword}
                onChange={handleChange}
                error={errors.confirmPassword}
                required
                icon={<LuLock className="h-4 w-4" />}
              />
            </CardBody>
            <CardFooter>
              <Button type="submit" variant="accent" loading={submitting} className="w-full sm:w-auto">
                {submitting ? "Updating" : "Update password"}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-concrete-500">
          <LuInfo className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Your role is {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "unknown"}. Contact your organisation administrator if you need your
          access level changed.
        </p>
      </div>
    </>
  );
};

export default ChangePassword;