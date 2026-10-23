import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  LuMail,
  LuLock,
  LuKeyRound,
  LuArrowLeft,
  LuMailCheck,
} from "react-icons/lu";
import AuthLayout from "../components/layout/AuthLayout";
import Button from "../components/ui/Button";
import { Input } from "../components/ui/Form";
import { Alert } from "../components/ui/Feedback";
import { getErrorMessage } from "../lib/api";
import {
  useForgotPasswordMutation,
  useResetPasswordMutation,
} from "../services/api/endpoints/authApi";

const STRONG_PASSWORD =
  /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{8,}$/;

const PASSWORD_MESSAGE =
  "Use at least 8 characters with an uppercase letter, a lowercase letter, a number and a special character.";

const ForgotPassword = () => {
  const [params] = useSearchParams();
  const tokenFromLink = params.get("token") || "";

  // A reset link is the only way into the reset step. Without one the user
  // starts by requesting an email - the token is never shown on screen.
  const [step, setStep] = useState(tokenFromLink ? "reset" : "request");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(null);

  const navigate = useNavigate();

  const [requestReset, { isLoading: requesting }] = useForgotPasswordMutation();
  const [resetPassword, { isLoading: resetting }] = useResetPasswordMutation();
  const loading = requesting || resetting;

  const handleRequestReset = async (event) => {
    event.preventDefault();
    setError(null);
    setMessage("");
    try {
      const result = await requestReset({ email: email.trim() }).unwrap();
      setMessage(result.message);
      setStep("sent");
    } catch (err) {
      setError(getErrorMessage(err, "Unable to process the request."));
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();
    setError(null);

    if (!STRONG_PASSWORD.test(newPassword)) {
      setError(PASSWORD_MESSAGE);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      await resetPassword({ resetToken: tokenFromLink, newPassword }).unwrap();
      navigate("/login", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, "Unable to reset the password."));
    }
  };

  const title =
    step === "reset"
      ? "Choose a new password"
      : step === "sent"
      ? "Check your email"
      : "Reset your password";

  const subtitle =
    step === "reset"
      ? "Your reset link is valid for a short time and can only be used once."
      : step === "sent"
      ? "If an account exists for that address, a password reset link is on its way."
      : "Enter the email address linked to your account and we'll send you a secure reset link.";

  return (
    <AuthLayout
      title={title}
      subtitle={subtitle}
      aside={
        <>
          Remembered it?{" "}
          <Link
            to="/login"
            className="rounded font-display text-sm font-semibold uppercase tracking-wide text-accent-600 hover:text-accent-700"
          >
            Back to sign in
          </Link>
        </>
      }
    >
      <Alert variant="error" className="mb-5" onDismiss={() => setError(null)}>
        {error}
      </Alert>

      {step === "request" && (
        <form onSubmit={handleRequestReset} className="space-y-4" noValidate>
          <Input
            label="Email address"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            required
            icon={<LuMail className="h-4 w-4" />}
          />
          <Button
            type="submit"
            variant="accent"
            size="lg"
            loading={loading}
            className="w-full"
          >
            {!loading && <LuKeyRound className="h-4 w-4" aria-hidden="true" />}
            {loading ? "Sending" : "Send reset link"}
          </Button>
          <p className="text-center text-xs leading-relaxed text-concrete-500">
            For security we always show the same confirmation, whether or not an
            account exists for the address.
          </p>
        </form>
      )}

      {step === "sent" && (
        <div className="space-y-5">
          <Alert variant="success">{message}</Alert>
          <div className="rounded-lg border border-concrete-200 bg-concrete-50 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-navy-900 text-white">
                <LuMailCheck className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="text-sm leading-relaxed text-navy-700">
                <p className="font-display font-semibold text-navy-900">
                  Didn&apos;t receive it?
                </p>
                <p className="mt-1">
                  Check your spam folder and make sure the address is correct.
                  If email delivery is unavailable, ask your administrator to
                  reset the password for you.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => {
                setStep("request");
                setMessage("");
              }}
            >
              <LuArrowLeft className="h-4 w-4" aria-hidden="true" />
              Try another email
            </Button>
            <Button
              type="button"
              variant="accent"
              className="flex-1"
              onClick={() => navigate("/login")}
            >
              Back to sign in
            </Button>
          </div>
        </div>
      )}

      {step === "reset" && (
        <form onSubmit={handleResetPassword} className="space-y-4" noValidate>
          <Input
            label="New password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Enter new password"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              setError(null);
            }}
            required
            icon={<LuLock className="h-4 w-4" />}
          />

          <Input
            label="Confirm password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Re-enter new password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setError(null);
            }}
            required
            icon={<LuLock className="h-4 w-4" />}
          />

          <p className="text-xs leading-relaxed text-concrete-500">
            {PASSWORD_MESSAGE}
          </p>

          <Button
            type="submit"
            variant="accent"
            size="lg"
            loading={loading}
            className="w-full"
          >
            {loading ? "Updating" : "Update password"}
          </Button>

          <Link
            to="/forgot-password"
            className="flex w-full items-center justify-center gap-1.5 text-sm font-medium text-concrete-500 hover:text-navy-800"
          >
            <LuArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Request a new link
          </Link>
        </form>
      )}
    </AuthLayout>
  );
};

export default ForgotPassword;
