# 🏗️ Builtra — Construction Management Platform

> **From plans to progress.**

Builtra is a construction operations platform for construction companies of every
size, built with the MERN stack (MongoDB, Express.js, React, Node.js). It gives
administrators, employees and clients one connected place to manage workforce,
attendance, leave, payroll, client work requests and site records — instead of
scattered spreadsheets and paper.

## 📋 Overview

Builtra centralises the everyday work of a construction business:

- **Workforce & sites** — employees, their construction site, designation and status.
- **Attendance** — a daily board per site, with corrections audited.
- **Leave** — applications with overlap detection and a decision workflow.
- **Payroll records** — per-employee salary entries and net-pay breakdowns.
- **Client work requests** — raised by the client, driven through a 13-state
  lifecycle by the contractor.
- **Projects** — the execution core: schedule, milestones, team, progress and
  billing position, with work requests converting into projects.
- **Tasks** — a site task board with ownership, priority, due dates and status.
- **Daily site reports** — workforce, plant, materials and photos, with an
  approval step that posts material usage into stock exactly once.
- **Inventory** — materials, an append-only stock ledger, site balances, reorder
  alerts and movement history.
- **Commercial controls** — vendors, expenses, client invoices and payments,
  with outstanding and overdue balances derived from the ledger.
- **Equipment & safety** — plant allocation, maintenance dates, incidents and
  corrective actions.
- **Documents** — private drawings, contracts, permits and receipts with
  per-record visibility.
- **Operations insight** — role-scoped reports with CSV export, an immutable
  audit trail, organisation settings, in-app notifications, global search and a
  grounded assistant.
- **Client onboarding** — accounts are created by invitation and the invited
  person sets their own password over a one-time, expiring link.

## 👥 Role-Based Access

| Role | What they get |
|---|---|
| **Administrator** | Full workforce administration, attendance and leave decisions, payroll, client accounts, work-request approvals, all operations modules, organisation settings, CSV exports and the audit trail |
| **Employee** | Own profile, attendance, leave and salary; assigned projects, tasks, site reports, stock movements, equipment, safety and documents. No commercial figures or stock valuation |
| **Client** | Own profile, own work requests, own projects and approved site reports, invoices/payments, shared documents and scoped reports |

Every permission is enforced **on the server**. Hiding a button in React is a
courtesy, not a security control. Commercial visibility follows the same rule:
administrators see cost and margin, clients see billed/paid/outstanding only, and
employees receive no cost, margin, stock valuation, equipment rate or purchase
cost in either the API response or the UI.

## 🗂️ Operations Workspace

Each role has its own dashboard prefix. The operations pages sit underneath it,
so a client cannot reach an admin screen simply by editing a URL.

| Area | Admin | Employee | Client |
|---|---|---|---|
| Dashboard | `/admin-dashboard` | `/employee-dashboard` | `/client-dashboard` |
| Projects | `…/projects` | assigned only | own only |
| Tasks | `…/tasks` | own/assigned | — |
| Daily reports | `…/daily-reports` | assigned sites | approved only |
| Inventory | `…/inventory` | movements, no costs | — |
| Vendors | `…/vendors` | — | — |
| Expenses | `…/expenses` | — | — |
| Invoices | `…/invoices` | — | own only |
| Equipment | `…/equipment` | no rates | — |
| Safety | `…/safety` | report/respond | — |
| Documents | `…/documents` | assigned scope | shared only |
| Reports & CSV | `…/reports` | scoped tabs | scoped tabs |
| Audit trail | `…/audit` | — | — |
| Organisation | `…/organization` | — | — |

Global search (`/`), in-app notifications and the assistant are available from
the top bar. The assistant answers from live, role-scoped database queries; it
does not require an external AI key.

## 🔐 Authentication & Account Security

- JWT authentication with role checks on every protected route.
- bcrypt password hashing — no plaintext, ever, anywhere.
- **Invitation-based onboarding for both employees and clients.** An administrator
  never types or sees a user's password; the invited person chooses their own
  through a single-use, expiring link.
- Cryptographically random invitation tokens; only a SHA-256 digest is stored.
- Rate limits on sign-in, invitation issuing, token verification and password setup.
- Invitation tokens are invalidated whenever a new one is issued.

## 🧭 Workflows

**Invitation flow (employees and clients)**

1. An administrator creates the account — no password field.
2. The account is created *pending*, and a one-time setup link is emailed.
3. The recipient opens `/activate?token=…`, chooses their own password.
4. The token is consumed atomically and the account becomes active.
5. The user signs in normally.

**Work request lifecycle**

```
Pending → Under Review → Approved → Assigned → In Progress → Completed → Verified → Closed
                ↓              ↓          ↓             ↓
        Returned for Correction · On Hold · Blocked · Cancelled · Rejected
```

Transitions are validated server-side; an illegal transition is refused with a
`409` and the list of states it *could* have moved to.

**Project delivery**

1. A work request is approved and converted into a project with a schedule and team.
2. Tasks are assigned, worked and completed on the board.
3. Site staff file daily reports with workforce, plant and materials.
4. An administrator approves the report; material usage posts to the stock ledger
   in a single transaction, so a retry can never double-count.
5. Progress rolls up to the project, client dashboard and reports.

**Inventory & billing**

- Stock is derived only from the append-only movement ledger (receipts, issues and
  audited adjustments); balances are never edited in place.
- Expense approval and invoice payment move the project's commercial position;
  invoice status is derived from payments and due date, and overdue rows refresh
  before they are read.
- Notifications are best-effort: a failed notification never rolls back or blocks
  the business operation that triggered it.

## 🛠️ Tech Stack

**Frontend** — React 18, Vite, Tailwind CSS, React Router 6, Redux Toolkit with
RTK Query, Axios, react-icons.

**Backend** — Node.js, Express 4, MongoDB with Mongoose, JWT, bcrypt, Multer,
express-validator.

**Database** — MongoDB (Atlas or local). A replica set is required, because site
archival, daily-report stock posting and the operations workflows use
multi-document transactions.

## 🚀 Getting Started

### Prerequisites

- Node.js 22.9 or newer (the scripts use `--env-file-if-exists`)
- MongoDB (Atlas or local) — a replica set is required for transactions
- npm

### 1. Backend (`BuildSync-API`)

```bash
cd BuildSync-API
npm install
cp .env.example .env      # then fill in your values
```

`.env`:

```env
PORT=5050
MONGODB_URL=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/builtra
JWT_SECRET=<a long random string>
FRONTEND_BASE_URL=http://localhost:5173
CLIENT_ORIGIN=http://localhost:5173
ADMIN_NAME=Your Name
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=<a strong password>
```

The API validates this configuration before it starts. `JWT_SECRET` must be at
least 32 characters and cannot be a placeholder. In production,
`CLIENT_ORIGIN` must name the public frontend origin(s) and
`FRONTEND_BASE_URL` must be the public URL used in invitation emails — a
localhost URL is rejected so a real invitation can never contain a dead link.

> **Existing installs:** the database name at the end of `MONGODB_URL` is the
> *database*, not the brand. The rebrand did not rename it — leave it as it is
> or your data will appear to vanish.

Generate a real JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 2. Frontend (`BuildSync-CLIENT`)

```bash
cd ../BuildSync-CLIENT
npm install
cp .env.local.example .env.local
```

`.env.local`:

```env
VITE_API_URL=http://localhost:5050/api
```

### 3. Create the first administrator

```bash
cd ../BuildSync-API
npm run seed
```

Seeding is idempotent: run it again and the existing administrator is left
untouched. It refuses a weak password and never creates a default account.

### 4. Run it

```bash
# Terminal 1 — API (production-style, no auto-reload)
cd BuildSync-API
npm start

# Terminal 2 — frontend
cd BuildSync-CLIENT
npm run dev
```

For API auto-reload while developing, use `npm run dev` in Terminal 1.

- Frontend: http://localhost:5173
- API: http://localhost:5050 (`/api/health` for a readiness check)

### Production checklist

- Set `NODE_ENV=production`.
- Set a unique `JWT_SECRET` (32+ random characters).
- Set `CLIENT_ORIGIN` to the exact public frontend origin(s).
- Set `FRONTEND_BASE_URL` to the public frontend URL.
- Configure `EMAIL_PROVIDER` (`http` or `smtp`) so invitations are delivered.
- Serve the frontend over HTTPS and terminate TLS at the reverse proxy.
- Set `TRUST_PROXY=true` only when a trusted proxy is in front of the API.
- Use a MongoDB replica set so transactional workflows can run.
- Run `npm run seed` and `npm run migrate` (both are safe to re-run).

### Running without a database

If you have no MongoDB available, the API can start against a temporary
in-memory database with demo data:

```bash
cd BuildSync-API
npm run dev:local
```

That database lives only as long as the process. Demo accounts (password
`Qa!Pass123`):

| Role | Email |
|---|---|
| Administrator | `admin@uitest.test` |
| Employee | `emp@uitest.test` |
| Client | `cli@uitest.test` |

Open the frontend at `http://localhost:5173` — sign-in uses a cookie, so
`127.0.0.1:5173` will not share the session and is treated as a different site.

### Tests

```bash
cd BuildSync-API
npm test
```

The suite runs against a real MongoDB. It uses an isolated `_test` database and
falls back to an in-process MongoDB replica set when no server is reachable, so
it never touches development or production data. It covers authentication and
RBAC, every operations resource, role-scoped reports, CSV quoting and
formula-injection protection, daily-report stock idempotency, and commercial
privacy for employees.

## 📧 Email delivery

Account invitations are emailed. Without a provider configured the API still
creates the account, but reports the invitation as **not delivered** and the
administrator gets the setup link to share manually — it never claims an email
was sent when it was not.

| Variable | Purpose |
|---|---|
| `EMAIL_PROVIDER` | `resend` (HTTP, no dependencies) or `smtp` (requires `nodemailer`) |
| `EMAIL_API_KEY` | API key for the HTTP provider |
| `EMAIL_FROM` | Sender address, e.g. `Builtra <no-reply@yourdomain.com>` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | SMTP provider settings |
| `FRONTEND_BASE_URL` | The public frontend origin used to build setup links |
| `INVITATION_TTL_HOURS` | How long a setup link stays valid (default 48) |

## 📁 File storage

Uploads are split by sensitivity, not by convenience:

| Upload | Location | Access |
|---|---|---|
| Profile photos, work-request attachments | `public/uploads` | Public static files |
| Daily-report photos | `public/uploads/reports` | Public, so site photos render in reports |
| Project documents | `private/documents` | Authenticated download route only |
| Expense receipts | `private/receipts` | Admin/authorised download route only |

Express serves only `public/uploads`. The `private/` tree is never mounted
statically — every download is checked against the project, site, client and
record visibility before the file is streamed. Filenames on disk are
collision-resistant random names; the original name is stored in the database
for display and never used as a path.

## 🔒 Security Notes

- Passwords are hashed with bcrypt and never returned by any endpoint.
- Invitation tokens are stored only as SHA-256 digests and are single-use.
- Token consumption is a single atomic `findOneAndUpdate`, so two simultaneous
  requests can never both succeed.
- Disabled accounts cannot activate through an old invitation.
- Uploads are restricted by extension, declared MIME type and size; the static
  upload directory is not executable content.
- Private documents and receipts are never written under `public/uploads`.
- IDs and permissions are always resolved from the session on the server;
  identifiers or roles supplied in a request body are ignored.
- CSV exports follow RFC 4180 quoting and neutralise spreadsheet formula
  injection (`=`, `+`, `-`, `@`) in every exported cell.
- The JWT secret, database credentials and email keys live in `.env`, which is
  git-ignored, and are never bundled into the frontend.

## 📄 Documentation

- `BuildSync-API/docs/AUDIT.md` — the audit and risk register that drove the
  security work.
- `BuildSync-API/docs/BRANDING.md` — what was renamed, and what deliberately
  was not.

## 🤝 Contributing

1. Fork the repository and create a feature branch.
2. Follow the existing code style.
3. Add tests for new behaviour.
4. Run `npm test` (API) and `npm run build` + `npm run lint` (client).
5. Open a pull request.

## 📄 License

MIT — see the `LICENSE` file.
