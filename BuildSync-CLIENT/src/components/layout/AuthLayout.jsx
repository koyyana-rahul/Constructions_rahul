import { LuHardHat, LuShieldCheck, LuHardDrive } from "react-icons/lu";

/**
 * Split auth layout. The left panel carries the construction brand identity,
 * the right panel hosts the form. Replaces the gradient + centred
 * floating box used by Login / Activate / Forgot Password.
 */
const AuthLayout = ({ children, title, subtitle, aside }) => (
  <div className="flex min-h-screen bg-concrete-100">
    {/* Brand panel */}
    <aside className="relative hidden w-[46%] shrink-0 flex-col justify-between overflow-hidden bg-navy-900 p-10 lg:flex xl:w-1/2 xl:p-14">
      {/* Subtle structural grid, evoking blueprint / plan drawings */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-accent-600/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-navy-500/20 blur-3xl"
      />

      <div className="relative flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-accent-600">
          <LuHardHat className="h-6 w-6 text-white" aria-hidden="true" />
        </span>
        <div>
          <p className="font-display text-xl font-semibold uppercase leading-none tracking-wider text-white">
            Build<span className="text-accent-400">Sync</span>
          </p>
          <p className="mt-0.5 font-display text-2xs uppercase tracking-[0.2em] text-navy-300">
            Construction Operations
          </p>
        </div>
      </div>

      <div className="relative max-w-md">
        <h2 className="font-display text-4xl font-semibold uppercase leading-[1.1] tracking-wide text-white xl:text-5xl">
          Run every site,
          <br />
          <span className="text-accent-400">workforce and request</span>
          <br />
          from one platform.
        </h2>
        <p className="mt-5 text-sm leading-relaxed text-navy-200">
          Attendance, leave, work requests, salary and client visibility for construction
          operations - structured around the way sites actually run.
        </p>

        <dl className="mt-9 grid grid-cols-3 gap-4 border-t border-navy-800 pt-6">
          {[
            { icon: LuHardDrive, label: "Site Records" },
            { icon: LuShieldCheck, label: "Role Access" },
            { icon: LuHardHat, label: "Crew Tracking" },
          ].map(({ icon: Icon, label }) => (
            <div key={label}>
              <Icon className="h-5 w-5 text-accent-400" aria-hidden="true" />
              <dt className="mt-2 font-display text-xs font-semibold uppercase tracking-wider text-navy-200">
                {label}
              </dt>
            </div>
          ))}
        </dl>
      </div>

      <p className="relative text-xs text-navy-400">
        &copy; {new Date().getFullYear()} BuildSync. All rights reserved.
      </p>
    </aside>

    {/* Form panel */}
    <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
      <div className="w-full max-w-md">
        {/* Mobile brand mark */}
        <div className="mb-8 flex items-center justify-center gap-3 lg:hidden">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-accent-600">
            <LuHardHat className="h-6 w-6 text-white" aria-hidden="true" />
          </span>
          <p className="font-display text-xl font-semibold uppercase tracking-wider text-navy-900">
            Build<span className="text-accent-600">Sync</span>
          </p>
        </div>

        <header className="mb-6">
          <h1 className="font-display text-3xl font-semibold uppercase tracking-wide text-navy-900">
            {title}
          </h1>
          {subtitle && <p className="mt-1.5 text-sm text-concrete-600">{subtitle}</p>}
        </header>

        {children}

        {aside && <div className="mt-6 text-center text-sm">{aside}</div>}
      </div>
    </main>
  </div>
);

export default AuthLayout;