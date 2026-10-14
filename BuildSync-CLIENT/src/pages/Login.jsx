import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LuMail, LuLock, LuEye, LuEyeOff, LuLogIn } from "react-icons/lu";
import AuthLayout from "../components/layout/AuthLayout";
import Button from "../components/ui/Button";
import { Input } from "../components/ui/Form";
import { Alert } from "../components/ui/Feedback";
import { getErrorMessage } from "../lib/api";
import { useLoginMutation } from "../services/api/endpoints/authApi";
import { homePathForRole } from "../features/auth/authSelectors";

/**
 * Sign-in.
 *
 * The mutation's `onQueryStarted` stores the JWT and writes the auth slice
 * BEFORE `unwrap()` resolves, so by the time this component navigates the
 * route guard already sees an authenticated user and lets the redirect through.
 * Navigating first would bounce straight back to /login.
 */
const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();

  const [login, { isLoading }] = useLoginMutation();

  const justActivated = location.state?.activated;
  // Set by PrivateRoutes when an anonymous visitor opens a protected deep link.
  const redirectTo = location.state?.from;
  const allowed = location.state?.allowed;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    try {
      const { user } = await login({ email, password }).unwrap();

      // Honour the originally requested page only when the signed-in role is
      // actually allowed there - the guard would otherwise bounce them to
      // their dashboard anyway, losing the intended destination.
      if (redirectTo && allowed?.includes(user.role)) {
        navigate(redirectTo, { replace: true });
      } else {
        navigate(homePathForRole(user.role), { replace: true });
      }
    } catch (err) {
      setError(getErrorMessage(err, "Unable to sign in. Please try again."));
    }
  };

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Access your site, workforce and request workspace."
      aside={
        <p className="text-concrete-500">
          New client accounts are created by your contractor.
          <br />
          Received an activation link?{" "}
          <Link
            to="/activate"
            className="rounded font-display text-sm font-semibold uppercase tracking-wide text-accent-600 hover:text-accent-700"
          >
            Set your password
          </Link>
        </p>
      }
    >
      {justActivated && (
        <div className="mb-5">
          <Alert variant="success">
            Your password has been set. You can now sign in.
          </Alert>
        </div>
      )}

      {error && (
        <Alert variant="error" className="mb-5" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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

        <Input
          label="Password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
          required
          trailing={
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
          }
        />

        <div className="flex items-center justify-between">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-navy-800">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-concrete-300 accent-navy-900"
            />
            Remember me
          </label>
          <Link
            to="/forgot-password"
            className="rounded text-sm font-medium text-accent-600 hover:text-accent-700"
          >
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          variant="accent"
          size="lg"
          loading={isLoading}
          className="w-full"
        >
          {!isLoading && <LuLogIn className="h-4 w-4" aria-hidden="true" />}
          {isLoading ? "Signing in" : "Sign in"}
        </Button>
      </form>

      <div className="mt-6 flex items-center justify-center gap-2 rounded-md border border-concrete-200 bg-white px-4 py-3">
        <LuLock className="h-3.5 w-3.5 shrink-0 text-concrete-400" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-concrete-500">
          Accounts are role-based. Employee and administrator access is provisioned by
          your organisation administrator.
        </p>
      </div>
    </AuthLayout>
  );
};

export default Login;