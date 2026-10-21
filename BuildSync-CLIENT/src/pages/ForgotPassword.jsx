import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LuMail, LuLock, LuKeyRound, LuArrowLeft } from "react-icons/lu";
import AuthLayout from "../components/layout/AuthLayout";
import Button from "../components/ui/Button";
import { Input } from "../components/ui/Form";
import { Alert } from "../components/ui/Feedback";
import { getErrorMessage } from "../lib/api";
import {
  useForgotPasswordMutation,
  useResetPasswordMutation,
} from "../services/api/endpoints/authApi";

const ForgotPassword = () => {
  const [step, setStep] = useState("request"); // "request" | "reset"
  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(null);

  const navigate = useNavigate();

  const [requestReset, { isLoading: requesting }] = useForgotPasswordMutation();
  const [resetPassword, { isLoading: resetting }] = useResetPasswordMutation();
  const loading = requesting || resetting;

  const handleRequestReset = async (event) => {
    event.preventDefault();
    setError(null);
    try {
      const { resetToken: token } = await requestReset({ email }).unwrap();
      setResetToken(token);
      setStep("reset");
    } catch (err) {
      setError(getErrorMessage(err, "Unable to process the request."));
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      await resetPassword({ resetToken, newPassword }).unwrap();
      navigate("/login", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, "Unable to reset the password."));
    }
  };

  return (
    <AuthLayout
      title={step === "request" ? "Reset your password" : "Choose a new password"}
      subtitle={
        step === "request"
          ? "Enter the email address linked to your account and we'll generate a reset token."
          : "Your reset token has been generated. Set a new password to continue."
      }
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

      {step === "request" ? (
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
            {loading ? "Generating" : "Generate reset token"}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleResetPassword} className="space-y-4" noValidate>
          <div className="rounded-md border border-concrete-200 bg-white p-3">
            <Input
              label="Reset token"
              name="resetToken"
              value={resetToken}
              onChange={(e) => setResetToken(e.target.value)}
              required
              readOnly
              className="font-mono text-xs"
            />
          </div>

          <Input
            label="New password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Enter new password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
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
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            icon={<LuLock className="h-4 w-4" />}
          />

          <Button
            type="submit"
            variant="accent"
            size="lg"
            loading={loading}
            className="w-full"
          >
            {loading ? "Updating" : "Update password"}
          </Button>

          <button
            type="button"
            onClick={() => {
              setStep("request");
              setResetToken("");
              setError(null);
            }}
            className="flex w-full items-center justify-center gap-1.5 text-sm font-medium text-concrete-500 hover:text-navy-800"
          >
            <LuArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Use a different email
          </button>
        </form>
      )}
    </AuthLayout>
  );
};

export default ForgotPassword;