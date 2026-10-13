import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  LuLock,
  LuEye,
  LuEyeOff,
  LuMail,
  LuUser,
  LuCheck,
  LuKeyRound,
  LuShieldCheck,
} from "react-icons/lu";
import AuthLayout from "../components/layout/AuthLayout";
import Button from "../components/ui/Button";
import { Input, Checkbox } from "../components/ui/Form";
import { Alert, Spinner, EmptyState } from "../components/ui/Feedback";
import { api, getErrorMessage } from "../lib/api";

const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (v) => v.length >= 8 },
  { label: "One uppercase letter", test: (v) => /[A-Z]/.test(v) },
  { label: "One lowercase letter", test: (v) => /[a-z]/.test(v) },
  { label: "One number", test: (v) => /\d/.test(v) },
  { label: "One special character", test: (v) => /[^a-zA-Z0-9]/.test(v) },
];

const STRONG = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{8,}$/;

const Activate = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const token = params.get("token") || "";

  const [checking, setChecking] = useState(Boolean(token));
  const [invite, setInvite] = useState(null);
  const [tokenError, setTokenError] = useState(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Validate the invitation link before showing the form.
  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/auth/activate?token=${encodeURIComponent(token)}`);
        if (!cancelled) setInvite(data);
      } catch (err) {
        if (!cancelled) setTokenError(getErrorMessage(err, "This activation link is not valid."));
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const passwordToggle = useMemo(
    () => (
      <button
        type="button"
        onClick={() => setShowPassword((v) => !v)}
        aria-label={showPassword ? "Hide password" : "Show password"}
        aria-pressed={showPassword}
        className="rounded p-1.5 text-concrete-400 transition-colors hover:bg-concrete-100 hover:text-navy-700"
      >
        {showPassword ? (
          <LuEyeOff className="h-4 w-4" aria-hidden="true" />
        ) : (
          <LuEye className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    ),
    [showPassword]
  );

  const validate = () => {
    const next = {};
    if (!STRONG.test(password)) {
      next.password =
        "Password must be at least 8 characters with an uppercase letter, a lowercase letter, a number and a special character";
    }
    if (!confirmPassword) next.confirmPassword = "Confirm your password";
    else if (confirmPassword !== password) next.confirmPassword = "Passwords do not match";
    if (!accepted) next.accepted = "Please confirm before continuing";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setError(null);

    try {
      const { data } = await api.post("/auth/activate", { token, password });
      if (data.success) navigate("/login", { state: { activated: true }, replace: true });
    } catch (err) {
      setError(getErrorMessage(err, "Unable to activate your account."));
    } finally {
      setSubmitting(false);
    }
  };

  // No token supplied at all.
  if (!token) {
    return (
      <AuthLayout
        title="Activate your account"
        subtitle="Open the activation link your contractor sent you to set your password."
        aside={
          <Link
            to="/login"
            className="rounded font-display text-sm font-semibold uppercase tracking-wide text-accent-600 hover:text-accent-700"
          >
            Back to sign in
          </Link>
        }
      >
        <EmptyState
          icon={LuKeyRound}
          title="No activation token"
          description="This page needs the one-time token from your activation link. Ask your contractor to resend the invitation."
        />
      </AuthLayout>
    );
  }

  if (checking) {
    return (
      <AuthLayout title="Activate your account" subtitle="Checking your invitation…">
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-center gap-3 py-10 text-concrete-500"
        >
          <Spinner className="h-7 w-7" />
          <p className="font-display text-sm uppercase tracking-widest">Verifying link</p>
        </div>
      </AuthLayout>
    );
  }

  if (tokenError) {
    return (
      <AuthLayout
        title="Activate your account"
        subtitle="We could not accept this activation link."
        aside={
          <Link
            to="/login"
            className="rounded font-display text-sm font-semibold uppercase tracking-wide text-accent-600 hover:text-accent-700"
          >
            Back to sign in
          </Link>
        }
      >
        <EmptyState
          icon={LuKeyRound}
          title="Link not valid"
          description={tokenError}
          action={
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-md bg-navy-900 px-4 py-2.5 font-display text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-navy-800"
            >
              Go to sign in
            </Link>
          }
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Set your password"
      subtitle={
        invite?.name
          ? `Welcome, ${invite.name}. Choose a password to activate your account.`
          : "Choose a password to activate your account."
      }
      aside={
        <p className="text-concrete-500">
          Already activated?{" "}
          <Link
            to="/login"
            className="rounded font-display text-sm font-semibold uppercase tracking-wide text-accent-600 hover:text-accent-700"
          >
            Sign in
          </Link>
        </p>
      }
    >
      {invite?.email && (
        <div className="mb-5 flex items-center gap-3 rounded-lg border border-concrete-200 bg-white px-4 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-navy-50 text-navy-700">
            <LuUser className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-semibold text-navy-900">
              {invite.name}
            </p>
            <p className="flex items-center gap-1.5 truncate text-xs text-concrete-500">
              <LuMail className="h-3 w-3 shrink-0" aria-hidden="true" />
              {invite.email}
            </p>
          </div>
        </div>
      )}

      <Alert variant="error" className="mb-5" onDismiss={() => setError(null)}>
        {error}
      </Alert>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          label="New password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Create a strong password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setErrors((p) => ({ ...p, password: undefined }));
          }}
          error={errors.password}
          required
          trailing={passwordToggle}
        />

        {password && (
          <ul className="-mt-2 space-y-1">
            {PASSWORD_RULES.map((rule) => {
              const passed = rule.test(password);
              return (
                <li
                  key={rule.label}
                  className={`flex items-center gap-1.5 text-xs ${
                    passed ? "text-success-700" : "text-concrete-400"
                  }`}
                >
                  <LuCheck
                    className={`h-3 w-3 shrink-0 ${passed ? "" : "opacity-30"}`}
                    aria-hidden="true"
                  />
                  {rule.label}
                </li>
              );
            })}
          </ul>
        )}

        <Input
          label="Confirm password"
          name="confirmPassword"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Re-enter your password"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            setErrors((p) => ({ ...p, confirmPassword: undefined }));
          }}
          error={errors.confirmPassword}
          required
          trailing={passwordToggle}
        />

        <Checkbox
          label="I understand I will use this password to sign in to my client account"
          name="accepted"
          checked={accepted}
          onChange={(e) => {
            setAccepted(e.target.checked);
            setErrors((p) => ({ ...p, accepted: undefined }));
          }}
          error={errors.accepted}
        />

        <Button
          type="submit"
          variant="accent"
          size="lg"
          loading={submitting}
          className="w-full"
        >
          {!submitting && <LuLock className="h-4 w-4" aria-hidden="true" />}
          {submitting ? "Activating" : "Activate account"}
        </Button>
      </form>

      <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-concrete-500">
        <LuShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        This activation link can be used once and expires automatically. Nobody at your
        contractor knows or can see the password you choose here.
      </p>
    </AuthLayout>
  );
};

export default Activate;