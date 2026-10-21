import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LuMail, LuLock, LuEye, LuEyeOff, LuLogIn, LuUserCheck } from "react-icons/lu";
import AuthLayout from "../components/layout/AuthLayout";
import Button from "../components/ui/Button";
import { Input } from "../components/ui/Form";
import { Alert } from "../components/ui/Feedback";
import { useLoginMutation } from "../services/api/endpoints/authApi";
import { homePathForRole } from "../features/auth/authSelectors";
import { getErrorMessage } from "../lib/api";

/**
 * Sign-in.
 *
 * The `useLoginMutation` hook owns the whole authentication handshake: on
 * success it writes the JWT to storage and pushes the verified user into the
 * auth slice (see `onQueryStarted` in `services/api/endpoints/authApi.js`).
 * This page therefore never touches localStorage or the session itself - it
 * only decides where to navigate afterwards, which is why the redirect target
 * is derived from the *server's* role claim rather than from anything the
 * visitor typed.
 */
const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [errors, setErrors] = useState({});

  const navigate = useNavigate();
  const location = useLocation();
  const [login, { isLoading }] = useLoginMutation();

  const justActivated = location.state?.activated;
  // Where the route guard wanted to send the visitor before signing in.
  const redirectTo = location.state?.from;

  const validate = () => {
    const next = {};
    if (!email.trim()) next.email = "Enter your email address";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      next.email = "Enter a valid email address";
    if (!password) next.password = "Enter your password";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    if (!validate()) return;

    try {
      const result = await login({ email: email.trim(), password }).unwrap();

      /**
       * The destination is derived from the role in the SERVER'S RESPONSE,
       * not from the store.
       *
       * `selectHomePath` reads `state.auth.user`, which is still empty at the
       * moment this handler runs - the store is updated by the mutation's
       * `onQueryStarted`, and whether React has re-rendered by then is a
       * race. Reading the stale selector value sent users back to /login
       * about half the time. The response is authoritative and immediate.
       */
      const roleHome = homePathForRole(result?.user?.role);

      // `redirectTo` is honoured only for the routes the guard actually
      // protects, otherwise a crafted `?from=` could bounce a signed-in user
      // somewhere unexpected.
      const destination =
        redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")
          ? redirectTo
          : roleHome;

      navigate(destination, { replace: true });
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
            className="rounded font-display text-sm font-semibold uppercase tracking-wide text-accent-600 transition-colors hover:text-accent-700 focus-visible:ring-2 focus-visible:ring-accent-500"
          >
            Set your password
          </Link>
        </p>
      }
    >
      {justActivated && (
        <Alert variant="success" className="mb-5">
          Your password is set. Sign in to continue.
        </Alert>
      )}

      <Alert variant="error" className="mb-5" onDismiss={() => setError(null)}>
        {error}
      </Alert>

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
            setErrors((prev) => ({ ...prev, email: undefined }));
          }}
          error={errors.email}
          required
          icon={<LuMail className="h-4 w-4" aria-hidden="true" />}
        />

        <Input
          label="Password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setErrors((prev) => ({ ...prev, password: undefined }));
          }}
          error={errors.password}
          required
          icon={<LuLock className="h-4 w-4" aria-hidden="true" />}
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="rounded p-1 text-concrete-400 transition-colors hover:text-navy-700 focus-visible:ring-2 focus-visible:ring-navy-400"
            >
              {showPassword ? (
                <LuEyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <LuEye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          }
        />

        <div className="flex items-center justify-between gap-3">
          <Link
            to="/forgot-password"
            className="rounded text-sm font-medium text-navy-700 underline-offset-4 transition-colors hover:text-accent-700 hover:underline focus-visible:ring-2 focus-visible:ring-accent-500"
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

      <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-concrete-500">
        <LuUserCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Access is decided by your account role. Client accounts are created by your
        contractor and activated by you - no administrator ever chooses your password.
      </p>
    </AuthLayout>
  );
};

export default Login;
