/**
 * End-to-end API smoke test against a RUNNING Builtra API.
 *
 * Exercises every endpoint the repaired frontend calls, as each of the three
 * roles, and prints a pass/fail matrix. Run it while the API is up:
 *
 *   node scripts/smoke.mjs [baseUrl]
 */
const BASE = process.argv[2] || "http://127.0.0.1:5050/api";

const CREDS = {
  admin: ["admin@uitest.test", "Qa!Pass123"],
  employee: ["emp@uitest.test", "Qa!Pass123"],
  client: ["cli@uitest.test", "Qa!Pass123"],
};

let pass = 0;
let fail = 0;
const failures = [];

const call = async (method, path, { token, body } = {}) => {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON */
  }
  return { status: res.status, body: json };
};

const check = (label, actual, expected) => {
  const ok = actual === expected;
  if (ok) pass++;
  else {
    fail++;
    failures.push(`${label}: expected ${expected}, got ${actual}`);
  }
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}  (${actual})`);
  return ok;
};

// ---------------------------------------------------------------- login
const tokens = {};
for (const [role, [email, password]] of Object.entries(CREDS)) {
  const r = await call("POST", "/auth/login", { body: { email, password } });
  check(`login as ${role}`, r.status, 200);
  tokens[role] = r.body?.token;
  if (r.body?.user?.role !== role) {
    fail++;
    failures.push(`login as ${role}: role claim was ${r.body?.user?.role}`);
  }
}

const T = tokens;

// ---------------------------------------------------------------- verify
console.log("\n[session]");
check("GET /auth/verify (admin)", (await call("GET", "/auth/verify", { token: T.admin })).status, 200);
check("GET /auth/verify (no token)", (await call("GET", "/auth/verify")).status, 401);

// ---------------------------------------------------------------- dashboard
console.log("\n[admin dashboard - the numbers the KPI tiles render]");
const dash = await call("GET", "/dashboard/summary", { token: T.admin });
check("GET /dashboard/summary", dash.status, 200);
check("  employees counted", typeof dash.body?.totalEmployees === "number", true);
check("  sites counted", typeof dash.body?.totalDepartments === "number", true);
check("  payroll labelled as commitment", typeof dash.body?.payrollCommitment?.monthlyConfiguredSalary === "number", true);
check("  leave breakdown present", typeof dash.body?.leaveSummary?.pending === "number", true);
check("  work request breakdown present", typeof dash.body?.workRequestSummary?.pending === "number", true);
check("  pending items list present", Array.isArray(dash.body?.pendingItems?.leaves), true);
check("GET /dashboard/summary (employee -> 403)", (await call("GET", "/dashboard/summary", { token: T.employee })).status, 403);
check("GET /dashboard/summary (client -> 403)", (await call("GET", "/dashboard/summary", { token: T.client })).status, 403);

// ---------------------------------------------------------------- departments
console.log("\n[construction sites]");
const depts = await call("GET", "/department", { token: T.admin });
check("GET /department", depts.status, 200);
check("  list returned", Array.isArray(depts.body?.departments) && depts.body.departments.length > 0, true);
check("GET /department (client -> 403)", (await call("GET", "/department", { token: T.client })).status, 403);

// ---------------------------------------------------------------- employees
console.log("\n[employees]");
const emps = await call("GET", "/employee", { token: T.admin });
check("GET /employee", emps.status, 200);
const firstEmp = emps.body?.employees?.[0];
check("  list returned", Array.isArray(emps.body?.employees) && emps.body.employees.length > 0, true);
check("  department populated", typeof firstEmp?.department?.dep_name === "string", true);
check("GET /employee/:id (admin)", (await call("GET", `/employee/${firstEmp._id}`, { token: T.admin })).status, 200);
check("GET /employee/:id (employee own)", (await call("GET", `/employee/${firstEmp._id}`, { token: T.employee })).status, 200);
check("GET /employee/:id (client -> 403)", (await call("GET", `/employee/${firstEmp._id}`, { token: T.client })).status, 403);
check("GET /employee/department/:id", (await call("GET", `/employee/department/${firstEmp.department._id}`, { token: T.admin })).status, 200);

// ---------------------------------------------------------------- clients
console.log("\n[clients]");
const clients = await call("GET", "/client", { token: T.admin });
check("GET /client (admin)", clients.status, 200);
const firstClient = clients.body?.clients?.[0];
check("  list returned", Array.isArray(clients.body?.clients) && clients.body.clients.length > 0, true);
const ownClients = await call("GET", "/client", { token: T.client });
check("GET /client (client scoped to own)", ownClients.status, 200);
check("  client sees only their own record", ownClients.body?.clients?.length, 1);
check("GET /client/:id (admin)", (await call("GET", `/client/${firstClient._id}`, { token: T.admin })).status, 200);
check("GET /client/:id (own client)", (await call("GET", `/client/${firstClient._id}`, { token: T.client })).status, 200);

// ---------------------------------------------------------------- leave
console.log("\n[leave]");
const leaveQueue = await call("GET", "/leave", { token: T.admin });
check("GET /leave (admin queue)", leaveQueue.status, 200);
check("  queue returned", Array.isArray(leaveQueue.body?.leaves) && leaveQueue.body.leaves.length > 0, true);
const myLeaves = await call("GET", "/leave/self/employee", { token: T.employee });
check("GET /leave/:id/employee (own history)", myLeaves.status, 200);
const leaveId = leaveQueue.body?.leaves?.[0]?._id;
check("GET /leave/detail/:id", (await call("GET", `/leave/detail/${leaveId}`, { token: T.admin })).status, 200);

// ---------------------------------------------------------------- salary
console.log("\n[payroll]");
const mySalary = await call("GET", "/salary/self/employee", { token: T.employee });
check("GET /salary/:id/employee (own payroll)", mySalary.status, 200);
check("  salary array returned", Array.isArray(mySalary.body?.salary), true);
check("GET /salary/:id/client (client -> 403)", (await call("GET", "/salary/self/client", { token: T.client })).status, 403);
const adminSalary = await call("GET", `/salary/${firstEmp._id}/admin?scope=admin`, { token: T.admin });
check("GET /salary/:id/admin?scope=admin", adminSalary.status, 200);

// ---------------------------------------------------------------- attendance
console.log("\n[attendance]");
const att = await call("GET", "/attendance", { token: T.admin });
check("GET /attendance", att.status, 200);
check("  rows returned", Array.isArray(att.body?.attendance), true);
const attReport = await call("GET", "/attendance/report", { token: T.admin });
check("GET /attendance/report", attReport.status, 200);
check("GET /attendance (employee -> 403)", (await call("GET", "/attendance", { token: T.employee })).status, 403);

// ---------------------------------------------------------------- work requests
console.log("\n[work requests]");
const wrAdmin = await call("GET", "/work-request", { token: T.admin });
check("GET /work-request (admin queue)", wrAdmin.status, 200);
const wrClient = await call("GET", "/work-request", { token: T.client });
check("GET /work-request (client scoped)", wrClient.status, 200);
const wrId = wrAdmin.body?.requests?.[0]?._id;
check("GET /work-request/detail/:id (admin)", (await call("GET", `/work-request/detail/${wrId}`, { token: T.admin })).status, 200);
check("GET /work-request/detail/:id (owning client)", (await call("GET", `/work-request/detail/${wrId}`, { token: T.client })).status, 200);
check("PUT /work-request/:id (client -> 403)", (await call("PUT", `/work-request/${wrId}`, { token: T.client, body: { status: "Approved" } })).status, 403);

// ---------------------------------------------------------------- client writes
console.log("\n[client writes]");
const created = await call("POST", "/work-request/add", {
  token: T.client,
  body: {
    name: "Smoke test request",
    description: "Created by the automated smoke test to prove the client submission path works.",
    startDate: "2027-01-01",
    endDate: "2027-01-10",
  },
});
check("POST /work-request/add (client)", created.status, 201);
check("  initial state is Pending", created.body?.request?.status, "Pending");

const leaveCreated = await call("POST", "/leave/add", {
  token: T.employee,
  body: { leaveType: "Casual Leave", startDate: "2027-11-01", endDate: "2027-11-03", reason: "Smoke test" },
});
check("POST /leave/add (employee)", leaveCreated.status, 201);

const cancelled = await call("PUT", `/leave/${leaveCreated.body?.leave?._id}/cancel`, { token: T.employee });
check("PUT /leave/:id/cancel (employee withdraws)", cancelled.status, 200);
check("  state is Cancelled", cancelled.body?.leave?.status, "Cancelled");

// ---------------------------------------------------------------- auth edges
console.log("\n[authorization edges]");
check("no token on /leave -> 401", (await call("GET", "/leave")).status, 401);
check("employee on /leave queue -> 403", (await call("GET", "/leave", { token: T.employee })).status, 403);
check("client on /employee -> 403", (await call("GET", "/employee", { token: T.client })).status, 403);
check("bad token -> 401", (await call("GET", "/leave", { token: "a.b.c" })).status, 401);

// ---------------------------------------------------------------- result
console.log(`\n${"─".repeat(60)}`);
console.log(`  ${pass} passed, ${fail} failed`);
if (failures.length) {
  console.log("\n  Failures:");
  for (const f of failures) console.log(`   - ${f}`);
}
console.log(`${"─".repeat(60)}\n`);
process.exit(fail === 0 ? 0 : 1);
