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
- **Client onboarding** — accounts are created by invitation and the invited
  person sets their own password over a one-time, expiring link.

## 👥 Role-Based Access

| Role | What they get |
|---|---|
| **Administrator** | Full workforce administration, attendance and leave decisions, payroll, client accounts, work-request approvals, operational reporting and the audit trail |
| **Employee** | Own profile, own attendance, own leave requests, own salary records, own settings |
| **Client** | Own profile, own work requests, request status tracking, own settings |

Every permission is enforced **on the server**. Hiding a button in React is a
courtesy, not a security control.

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
3. The recipient opens `/setup-password?token=…`, chooses their own password.
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

## 🛠️ Tech Stack

**Frontend** — React 18, Vite, Tailwind CSS, React Router 6, Redux Toolkit with
RTK Query, Axios, react-icons.

**Backend** — Node.js, Express 4, MongoDB with Mongoose, JWT, bcrypt, Multer,
express-validator.

**Database** — MongoDB (Atlas or local). A replica set is required, because the
site archival flow uses multi-document transactions.

## 🚀 Getting Started

### Prerequisites

- Node.js 18 or newer
- MongoDB (Atlas or local) — a replica set if you want transactions
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
ADMIN_NAME=Your Name
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=<a strong password>
```

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

### 4. Run it

```bash
# Terminal 1 — API
cd BuildSync-API
npm start

# Terminal 2 — frontend
cd BuildSync-CLIENT
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:5000 (`/api/health` for a readiness check)

### Running without a database

If you have no MongoDB available, the API can start against a temporary
in-memory database with demo data:

```bash
cd BuildSync-API
npm run dev:local
```

That database lives only as long as the process. Sign in with
`admin@uitest.test` / `Qa!Pass123`.

### Tests

```bash
cd BuildSync-API
npm test
```

The suite runs against a real MongoDB. It uses an isolated `_test` database and
falls back to an in-process MongoDB when no server is reachable, so it never
touches development or production data.

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

## 🔒 Security Notes

- Passwords are hashed with bcrypt and never returned by any endpoint.
- Invitation tokens are stored only as SHA-256 digests and are single-use.
- Token consumption is a single atomic `findOneAndUpdate`, so two simultaneous
  requests can never both succeed.
- Disabled accounts cannot activate through an old invitation.
- Uploads are restricted by type and size; the static upload directory is not
  executable content.
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
