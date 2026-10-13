import { before, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
  connectTestDb,
  disconnectTestDb,
  startApp,
  stopApp,
  api,
  loginAs,
} from "./helpers.js";

import User from "../models/User.js";
import Employee from "../models/Employee.js";
import Department from "../models/Department.js";
import Client from "../models/Client.js";
import Leave from "../models/Leave.js";

const PASSWORD = "Test!Pass123";
const ids = {};

/** Fixtures are created directly in the database - no API bootstrapping. */
async function seed() {
  const bcrypt = (await import("bcrypt")).default;
  const hash = await bcrypt.hash(PASSWORD, 10);

  const dept = await Department.create({ dep_name: "Test Site" });
  const admin = await User.create({ name: "Admin", email: "admin@test.local", password: hash, role: "admin" });
  const emp = await User.create({ name: "Emp", email: "emp@test.local", password: hash, role: "employee" });
  const cli = await User.create({ name: "Cli", email: "cli@test.local", password: hash, role: "client" });
  const empRec = await Employee.create({ userId: emp._id, employeeId: "T-001", department: dept._id, salary: 50000 });
  const cliRec = await Client.create({ userId: cli._id, entityType: "legal", companyName: "Test Co" });

  Object.assign(ids, {
    admin: admin._id, empUser: emp._id, empRec: empRec._id,
    cliUser: cli._id, cliRec: cliRec._id, dept: dept._id,
    clientUserId: cli._id,
  });
}

let adminT; let empT; let cliT;

before(async () => {
  await connectTestDb();
  await startApp();
  await seed();
  adminT = await loginAs("admin@test.local", PASSWORD);
  empT = await loginAs("emp@test.local", PASSWORD);
  cliT = await loginAs("cli@test.local", PASSWORD);
});

after(async () => {
  await stopApp();
  await disconnectTestDb();
});

/* ------------------------------------------------------------------ */
/* Authentication                                                      */
/* ------------------------------------------------------------------ */
describe("authentication", () => {
  it("rejects a request with no token", async () => {
    assert.equal((await api("GET", "/leave")).status, 401);
  });

  it("rejects a malformed Authorization header", async () => {
    assert.equal((await api("GET", "/leave", { token: "not-a-bearer" })).status, 401);
  });

  it("rejects a token with an invalid signature", async () => {
    assert.equal((await api("GET", "/leave", { token: "a.b.c" })).status, 401);
  });

  it("does not reveal whether an email exists", async () => {
    const unknown = await api("POST", "/auth/login", { body: { email: "nobody@test.local", password: "whatever1" } });
    const wrongPw = await api("POST", "/auth/login", { body: { email: "admin@test.local", password: "whatever1" } });
    assert.equal(unknown.status, wrongPw.status);
    assert.equal(unknown.body.error, wrongPw.body.error);
  });

  it("returns 404 JSON for unknown routes", async () => {
    const r = await api("GET", "/nope", { token: adminT });
    assert.equal(r.status, 404);
    assert.equal(r.body.success, false);
  });

  it("blocks a disabled account at login and at verify", async () => {
    const bcrypt = (await import("bcrypt")).default;
    const disabled = await User.create({
      name: "Disabled", email: "off@test.local", password: await bcrypt.hash(PASSWORD, 10), role: "employee", isDisabled: true,
    });
    assert.equal(await loginAs("off@test.local", PASSWORD), null);

    const jwt = (await import("jsonwebtoken")).default;
    const token = jwt.sign({ _id: disabled._id, role: "employee" }, process.env.JWT_SECRET, { expiresIn: "1d" });
    assert.equal((await api("GET", "/auth/verify", { token })).status, 403);

    await User.deleteOne({ _id: disabled._id });
  });
});

/* ------------------------------------------------------------------ */
/* R0 - password change IDOR                                           */
/* ------------------------------------------------------------------ */
describe("password change (R0)", () => {
  it("ignores a client-supplied userId and changes only the caller's password", async () => {
    const r = await api("PUT", "/setting/change-password", {
      token: cliT,
      body: { userId: String(ids.admin), oldPassword: PASSWORD, newPassword: "Moved!On99" },
    });
    assert.equal(r.status, 200, "the caller changed their own password");

    // The admin's password must be untouched.
    assert.notEqual(await loginAs("admin@test.local", PASSWORD), null);

    // The client's password is the new one.
    assert.notEqual(await loginAs("cli@test.local", "Moved!On99"), null);
  });

  it("rejects a wrong current password", async () => {
    const r = await api("PUT", "/setting/change-password", {
      token: adminT, body: { oldPassword: "wrong-one", newPassword: "Test!Pass123" },
    });
    assert.equal(r.status, 400);
    assert.equal(r.body.code, "WRONG_PASSWORD");
  });

  it("rejects a weak new password", async () => {
    const r = await api("PUT", "/setting/change-password", {
      token: adminT, body: { oldPassword: PASSWORD, newPassword: "weak" },
    });
    assert.equal(r.status, 400);
    assert.equal(r.body.code, "WEAK_PASSWORD");
  });

  it("only lets an admin use the administrative reset", async () => {
    const denied = await api("PUT", `/setting/admin/reset-password/${ids.empUser}`, {
      token: empT, body: { newPassword: "Reset!2345" },
    });
    assert.equal(denied.status, 403);

    const allowed = await api("PUT", `/setting/admin/reset-password/${ids.empUser}`, {
      token: adminT, body: { newPassword: "Reset!2345" },
    });
    assert.equal(allowed.status, 200);
    assert.notEqual(await loginAs("emp@test.local", "Reset!2345"), null);
  });
});

/* ------------------------------------------------------------------ */
/* R1 - client routes                                                   */
/* ------------------------------------------------------------------ */
describe("client routes (R1)", () => {
  it("requires authentication to list clients", async () => {
    assert.equal((await api("GET", "/client")).status, 401);
  });

  it("forbids a client from creating clients", async () => {
    const r = await api("POST", "/client/add", {
      token: cliT, body: { name: "X", email: "x@test.local", entityType: "legal", password: "abcdef" },
    });
    assert.equal(r.status, 403);
  });

  it("scopes a client's list to their own record", async () => {
    const r = await api("GET", "/client", { token: cliT });
    assert.equal(r.status, 200);
    assert.equal(r.body.clients.length, 1);
    assert.equal(r.body.clients[0].userId._id, String(ids.cliUser));
  });

  it("forbids a client reading another client's record", async () => {
    const other = await Client.create({ userId: ids.empUser, entityType: "legal" });
    const r = await api("GET", `/client/${other._id}`, { token: cliT });
    assert.equal(r.status, 403);
    await Client.deleteOne({ _id: other._id });
  });
});

/* ------------------------------------------------------------------ */
/* R2 / R3 - work request identity and role authorization               */
/* ------------------------------------------------------------------ */
describe("work requests", () => {
  it("requires authentication to create a request", async () => {
    const r = await api("POST", "/work-request/add", {
      body: { name: "x", description: "y", startDate: "2026-01-01", endDate: "2026-01-02" },
    });
    assert.equal(r.status, 401);
  });

  it("cannot be filed as another client", async () => {
    const r = await api("POST", "/work-request/add", {
      token: empT,
      body: { userId: String(ids.cliUser), name: "impersonation", description: "should not exist", startDate: "2026-01-01", endDate: "2026-01-02" },
    });
    assert.ok([403, 404].includes(r.status));

    const list = await api("GET", "/work-request", { token: cliT });
    assert.equal((list.body.requests ?? []).some((x) => x.name === "impersonation"), false);
  });

  it("enforces the state machine server-side", async () => {
    const created = await api("POST", "/work-request/add", {
      token: cliT,
      body: { name: "Lifecycle", description: "test transitions", startDate: "2026-06-01", endDate: "2026-06-10" },
    });
    assert.equal(created.status, 201);
    const wr = created.body.request._id;
    assert.equal(created.body.request.status, "Pending");

    assert.equal((await api("PUT", `/work-request/${wr}`, { token: empT, body: { status: "Approved" } })).status, 403);

    const noReason = await api("PUT", `/work-request/${wr}`, { token: adminT, body: { status: "Rejected" } });
    assert.equal(noReason.status, 400);
    assert.equal(noReason.body.code, "REASON_REQUIRED");

    const illegal = await api("PUT", `/work-request/${wr}`, { token: adminT, body: { status: "Verified" } });
    assert.equal(illegal.status, 409);
    assert.equal(illegal.body.code, "INVALID_TRANSITION");

    assert.equal((await api("PUT", `/work-request/${wr}`, { token: adminT, body: { status: "Approved" } })).status, 200);
    assert.equal((await api("PUT", `/work-request/${wr}`, { token: adminT, body: { status: "In Progress" } })).status, 200);
    assert.equal((await api("PUT", `/work-request/${wr}`, { token: adminT, body: { status: "Bananas" } })).status, 400);
  });

  it("excludes employees from the client-scoped read", async () => {
    const r = await api("GET", `/work-request/${ids.cliRec}/client`, { token: empT });
    assert.equal(r.status, 403);
  });
});

describe("role authorization (R3)", () => {
  const denied = [
    ["GET", "/employee", "employee"],
    ["GET", "/employee", "client"],
    ["GET", "/client", "employee"],
    ["GET", "/dashboard/summary", "employee"],
    ["GET", "/dashboard/summary", "client"],
    ["GET", "/attendance", "employee"],
    ["GET", "/leave", "employee"],
    ["GET", "/department", "client"],
  ];

  for (const [method, path, who] of denied) {
    it(`forbids ${who} from ${method} ${path}`, async () => {
      const token = who === "employee" ? empT : cliT;
      assert.equal((await api(method, path, { token })).status, 403);
    });
  }

  it("forbids an employee recording payroll", async () => {
    const r = await api("POST", "/salary/add", {
      token: empT, body: { employeeId: String(ids.empRec), basicSalary: 1, payDate: "2026-01-01" },
    });
    assert.equal(r.status, 403);
  });

  it("allows an admin to read the dashboard", async () => {
    assert.equal((await api("GET", "/dashboard/summary", { token: adminT })).status, 200);
  });
});

/* ------------------------------------------------------------------ */
/* Leave                                                               */
/* ------------------------------------------------------------------ */
describe("leave management", () => {
  it("lets an employee submit leave for themselves", async () => {
    const r = await api("POST", "/leave/add", {
      token: empT,
      body: { leaveType: "Sick Leave", startDate: "2027-03-01", endDate: "2027-03-05", reason: "Recovery" },
    });
    assert.equal(r.status, 201);
    ids.leave = r.body.leave._id;
  });

  it("rejects an overlapping application", async () => {
    const r = await api("POST", "/leave/add", {
      token: empT,
      body: { leaveType: "Casual Leave", startDate: "2027-03-04", endDate: "2027-03-09", reason: "Overlap" },
    });
    assert.equal(r.status, 409);
    assert.equal(r.body.code, "OVERLAPPING_LEAVE");
  });

  it("rejects an end date before the start date", async () => {
    const r = await api("POST", "/leave/add", {
      token: empT,
      body: { leaveType: "Casual Leave", startDate: "2027-05-10", endDate: "2027-05-01", reason: "Reversed" },
    });
    assert.equal(r.status, 400);
  });

  it("forbids a client applying for leave", async () => {
    const r = await api("POST", "/leave/add", {
      token: cliT,
      body: { leaveType: "Sick Leave", startDate: "2027-04-01", endDate: "2027-04-02", reason: "No" },
    });
    assert.equal(r.status, 403);
  });

  it("lets an admin decide once, then refuses a second decision", async () => {
    assert.equal((await api("PUT", `/leave/${ids.leave}`, { token: adminT, body: { status: "Approved" } })).status, 200);
    const second = await api("PUT", `/leave/${ids.leave}`, { token: adminT, body: { status: "Rejected" } });
    assert.equal(second.status, 409);
    assert.equal(second.body.code, "INVALID_TRANSITION");
  });

  it("rejects an unknown status", async () => {
    const r = await api("PUT", `/leave/${ids.leave}`, { token: adminT, body: { status: "Bananas" } });
    assert.equal(r.status, 400);
  });
});

/* ------------------------------------------------------------------ */
/* Attendance                                                          */
/* ------------------------------------------------------------------ */
describe("attendance", () => {
  it("creates rows idempotently and defaults them to unmarked", async () => {
    const first = await api("GET", "/attendance", { token: adminT });
    const second = await api("GET", "/attendance", { token: adminT });
    assert.equal(first.status, 200);
    assert.equal(first.body.attendance.length, second.body.attendance.length);
    assert.ok(first.body.attendance.length > 0);

    const row = first.body.attendance.find((a) => !a.status);
    assert.equal(row.status, null, "a fresh row must not be marked present");
  });

  it("normalises a lowercase status and rejects an invalid one", async () => {
    const ok = await api("PUT", "/attendance/update/T-001", { token: adminT, body: { status: "present" } });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.attendance.status, "Present");

    const bad = await api("PUT", "/attendance/update/T-001", { token: adminT, body: { status: "Vacation" } });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.code, "INVALID_ATTENDANCE_STATUS");
  });

  it("requires a reason to correct an already-marked day", async () => {
    const noReason = await api("PUT", "/attendance/update/T-001", { token: adminT, body: { status: "Absent" } });
    assert.equal(noReason.status, 400);
    assert.equal(noReason.body.code, "CORRECTION_REASON_REQUIRED");

    const withReason = await api("PUT", "/attendance/update/T-001", {
      token: adminT, body: { status: "Absent", reason: "mis-keyed" },
    });
    assert.equal(withReason.status, 200);
    assert.equal(withReason.body.attendance.status, "Absent");
  });

  it("rejects an unknown employee", async () => {
    const r = await api("PUT", "/attendance/update/NOPE-999", { token: adminT, body: { status: "Present" } });
    assert.equal(r.status, 404);
  });
});

/* ------------------------------------------------------------------ */
/* Salary privacy                                                      */
/* ------------------------------------------------------------------ */
describe("salary privacy", () => {
  it("lets an employee read their own payroll", async () => {
    const r = await api("GET", `/salary/${ids.empUser}/employee`, { token: empT });
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.body.salary));
  });

  it("ignores a spoofed role parameter when resolving payroll", async () => {
    const r = await api("GET", `/salary/${ids.empRec}/admin`, { token: empT });
    assert.equal(r.status, 200);
    // Same shape as their own payroll; no other employee's record leaks.
    const own = await api("GET", `/salary/${ids.empUser}/employee`, { token: empT });
    assert.deepEqual(r.body.salary, own.body.salary);
  });

  it("forbids a client entirely", async () => {
    const r = await api("GET", `/salary/${ids.cliUser}/client`, { token: cliT });
    assert.equal(r.status, 403);
  });
});

/* ------------------------------------------------------------------ */
/* Site archival (R4)                                                   */
/* ------------------------------------------------------------------ */
describe("site archival", () => {
  it("archives without destroying history and blocks new hires", async () => {
    assert.equal((await api("PUT", `/department/${ids.dept}/archive`, { token: adminT, body: { reason: "closed" } })).status, 200);

    const list = await api("GET", "/department", { token: adminT });
    assert.equal(list.body.departments.some((d) => d._id === String(ids.dept)), false);

    const withArchived = await api("GET", "/department?includeArchived=true", { token: adminT });
    assert.equal(withArchived.body.departments.some((d) => d._id === String(ids.dept)), true);

    const hire = await api("POST", "/employee/add", {
      token: adminT,
      body: { name: "Late", email: "late@test.local", employeeId: "T-LATE", department: String(ids.dept), password: "abcdef" },
    });
    assert.equal(hire.status, 409);
  });

  it("refuses a hard delete while history exists", async () => {
    const r = await api("DELETE", `/department/${ids.dept}`, { token: adminT });
    assert.equal(r.status, 409);
    assert.equal(r.body.code, "HISTORICAL_DEPENDENCIES");
  });

  it("restores the site and re-enables its employees", async () => {
    assert.equal((await api("PUT", `/department/${ids.dept}/restore`, { token: adminT })).status, 200);
    const emp = await Employee.findById(ids.empRec);
    assert.equal(emp.isActive, true);
  });
});

/* ------------------------------------------------------------------ */
/* Administrator-controlled client onboarding                           */
/* ------------------------------------------------------------------ */
describe("client onboarding", () => {
  const invite = async (overrides = {}) => {
    const stamp = Date.now() + Math.random().toString(36).slice(2, 7);
    return api("POST", "/client/add", {
      token: adminT,
      body: {
        name: "Invited Client",
        email: `invite-${stamp}@test.local`,
        phone: "+91 98765 43210",
        companyName: "Invited Co",
        entityType: "legal",
        ...overrides,
      },
    });
  };

  it("removes the public self-registration endpoint", async () => {
    const r = await api("POST", "/auth/register", {
      body: {
        name: "Sneaky", email: `sneaky-${Date.now()}@test.local`,
        phone: "9876543210", companyName: "Sneaky Co", entityType: "legal",
        password: "Str0ng@Pass1", confirmPassword: "Str0ng@Pass1",
      },
    });
    assert.equal(r.status, 404);
    assert.equal(r.body.code, "ROUTE_NOT_FOUND");
  });

  it("lets an administrator invite a client and returns a one-time token", async () => {
    const r = await invite();
    assert.equal(r.status, 201);
    assert.ok(r.body.activation.token);
    assert.ok(new Date(r.body.activation.expiresAt) > new Date());
  });

  it("never accepts a password on the invite payload", async () => {
    const r = await invite({ password: "AdminChosen!1" });
    assert.equal(r.status, 201);
    // The stored hash must not be the admin-supplied password.
    const created = await User.findOne({ email: r.body.client.email });
    assert.notEqual(created.password, "AdminChosen!1");
    const bcrypt = (await import("bcrypt")).default;
    assert.equal(await bcrypt.compare("AdminChosen!1", created.password), false);
  });

  it("refuses a duplicate invitation email", async () => {
    const first = await invite();
    const email = first.body.client.email;
    const second = await invite({ email });
    assert.equal(second.status, 409);
    assert.equal(second.body.code, "INVITATION_PENDING");
  });

  it("blocks an invited client from signing in before activation", async () => {
    const r = await invite();
    const email = r.body.client.email;
    // Even a guessed password cannot get in - the account holds an
    // unguessable placeholder hash.
    const token = await loginAs(email, "anything123");
    assert.equal(token, null);
    const blocked = await api("POST", "/auth/login", {
      body: { email, password: "anything123" },
    });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.code, "ACCOUNT_NOT_ACTIVATED");
  });

  it("rejects an invalid or expired activation token", async () => {
    const bad = await api("POST", "/auth/activate", {
      body: { token: "deadbeef".repeat(8), password: "Str0ng@Pass1" },
    });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.code, "INVALID_TOKEN");
  });

  it("rejects a weak password at activation", async () => {
    const r = await invite();
    const weak = await api("POST", "/auth/activate", {
      body: { token: r.body.activation.token, password: "weak" },
    });
    assert.equal(weak.status, 400);
    assert.equal(weak.body.code, "WEAK_PASSWORD");
  });

  it("lets the invitee set their own password, once", async () => {
    const r = await invite();
    const token = r.body.activation.token;
    const email = r.body.client.email;

    // Verify the link is recognised before the form is shown.
    const probe = await api("GET", `/auth/activate?token=${encodeURIComponent(token)}`);
    assert.equal(probe.status, 200);
    assert.equal(probe.body.email, email);

    const activated = await api("POST", "/auth/activate", {
      body: { token, password: "ClientChosen!9" },
    });
    assert.equal(activated.status, 200);
    const user = await User.findOne({ email });

    // Single use.
    const replay = await api("POST", "/auth/activate", {
      body: { token, password: "SomethingElse!9" },
    });
    assert.equal(replay.status, 400);
    assert.equal(replay.body.code, "INVALID_TOKEN");

    // And the chosen password now works.
    const session = await loginAs(email, "ClientChosen!9");
    assert.notEqual(session, null);

    ids.activatedClientEmail = email;
    ids.activatedClientUserId = String(user._id);
  });

  it("links the activated client to their own Client profile", async () => {
    const user = await User.findOne({ email: ids.activatedClientEmail });
    assert.equal(user.role, "client");
    assert.equal(user.isActivated, true);

    const profile = await Client.findOne({ userId: user._id });
    assert.ok(profile, "a Client profile must exist for the user");
    assert.equal(String(profile.userId), String(user._id));
  });

  it("forbids non-administrators from inviting clients", async () => {
    for (const token of [empT, (await loginAs(ids.activatedClientEmail, "ClientChosen!9"))]) {
      const r = await api("POST", "/client/add", {
        token,
        body: {
          name: "Nope", email: `nope-${Date.now()}@test.local`,
          phone: "9876543210", companyName: "Nope", entityType: "legal",
        },
      });
      assert.equal(r.status, 403);
    }
  });

  it("only lets an administrator re-issue an invitation", async () => {
    const r = await invite();
    const email = r.body.client.email;
    const user = await User.findOne({ email });

    const denied = await api("POST", `/auth/invitations/${user._id}/resend`, { token: empT });
    assert.equal(denied.status, 403);

    const allowed = await api("POST", `/auth/invitations/${user._id}/resend`, { token: adminT });
    assert.equal(allowed.status, 200);
    assert.ok(allowed.body.activationToken);

    // The re-issued token supersedes the original.
    const original = await api("POST", "/auth/activate", {
      body: { token: r.body.activation.token, password: "Str0ng@Pass1" },
    });
    assert.equal(original.status, 400);

    const fresh = await api("POST", "/auth/activate", {
      body: { token: allowed.body.activationToken, password: "FreshPass!9" },
    });
    assert.equal(fresh.status, 200);
  });
});

/* ------------------------------------------------------------------ */
/* Client access restrictions (server-side)                            */
/* ------------------------------------------------------------------ */
describe("client access restrictions", () => {
  let clientT;
  let otherClientRecordId;

  before(async () => {
    clientT = await loginAs(ids.activatedClientEmail, "ClientChosen!9");

    const otherUser = await User.create({
      name: "Other Client", email: "other-client@test.local",
      password: await bcryptHash(), role: "client",
    });
    otherClientRecordId = (
      await Client.create({ userId: otherUser._id, entityType: "legal", companyName: "Other Co" })
    )._id;
  });

  async function bcryptHash() {
    const bcrypt = (await import("bcrypt")).default;
    return bcrypt.hash("OtherClient!9", 10);
  }

  it("cannot list other clients", async () => {
    const r = await api("GET", "/client", { token: clientT });
    assert.equal(r.status, 200);
    assert.ok(r.body.clients.length >= 1);
    assert.ok(
      r.body.clients.every((c) => String(c.userId._id) === ids.activatedClientUserId),
      "a client must only ever receive their own record"
    );
  });

  it("cannot read another client's record", async () => {
    const r = await api("GET", `/client/${otherClientRecordId}`, { token: clientT });
    assert.equal(r.status, 403);
    assert.equal(r.body.code, "FORBIDDEN_OWNERSHIP");
  });

  it("cannot reach employee or payroll administration", async () => {
    assert.equal((await api("GET", "/employee", { token: clientT })).status, 403);
    assert.equal((await api("GET", "/dashboard/summary", { token: clientT })).status, 403);
    assert.equal((await api("GET", "/department", { token: clientT })).status, 403);
    assert.equal((await api("GET", "/leave", { token: clientT })).status, 403);
  });

  it("cannot read any salary record", async () => {
    const r = await api("GET", `/salary/${ids.empUser}/client`, { token: clientT });
    assert.equal(r.status, 403);
  });

  it("submits a work request as itself", async () => {
    const r = await api("POST", "/work-request/add", {
      token: clientT,
      body: {
        name: "Onboarding work request",
        description: "Created by the onboarding test to prove client submissions work.",
        startDate: "2027-04-01", endDate: "2027-04-10",
      },
    });
    assert.equal(r.status, 201);

    const mine = await api("GET", "/work-request", { token: clientT });
    assert.ok(mine.body.requests.some((x) => x._id === r.body.request._id));

    ids.workRequestId = r.body.request._id;
  });

  it("sees only its own work requests", async () => {
    const all = await api("GET", "/work-request", { token: adminT });
    const other = all.body.requests.find((x) => x._id !== ids.workRequestId);

    if (other) {
      const r = await api("GET", `/work-request/detail/${other._id}`, { token: clientT });
      assert.equal(r.status, 403);
    }
  });

  it("cannot approve or reject its own request", async () => {
    const r = await api("PUT", `/work-request/${ids.workRequestId}`, {
      token: clientT, body: { status: "Approved" },
    });
    assert.equal(r.status, 403);
  });
});

/* ------------------------------------------------------------------ */
/* Per-employee scoping and forged-role access (R14)                   */
/*                                                                     */
/* Admin pages address a specific employee through the URL. These tests */
/* pin down both halves of that contract:                              */
/*   - an admin may read any employee's records by Employee._id         */
/*   - an employee may only ever read their own, regardless of what    */
/*     `:role` segment or `:id` they put in the URL                  */
/* ------------------------------------------------------------------ */
describe("employee-scoped records", () => {
  // A second employee, so "another employee's data" is actually reachable.
  let otherEmpRec;
  let otherEmpT;
  let otherLeaveId;

  before(async () => {
    const bcrypt = (await import("bcrypt")).default;
    const hash = await bcrypt.hash(PASSWORD, 10);
    const user = await User.create({
      name: "Emp2",
      email: "emp2@test.local",
      password: hash,
      role: "employee",
    });
    const rec = await Employee.create({
      userId: user._id,
      employeeId: "T-002",
      department: ids.dept,
      salary: 41000,
    });
    otherEmpRec = rec._id.toString();
    otherEmpT = await loginAs("emp2@test.local", PASSWORD);

    const leave = await Leave.create({
      employeeId: rec._id,
      leaveType: "Casual Leave",
      startDate: new Date("2027-05-04"),
      endDate: new Date("2027-05-06"),
      reason: "Second employee's leave",
      status: "Pending",
    });
    otherLeaveId = leave._id.toString();
  });

  /* ------------------------------ leave ----------------------------- */

  it("gives an admin exactly the selected employee's leave", async () => {
    const r = await api("GET", `/leave/${otherEmpRec}/admin`, { token: adminT });
    assert.equal(r.status, 200);
    assert.equal(r.body.leaves.length, 1);
    assert.equal(r.body.leaves[0]._id, otherLeaveId);
    assert.equal(r.body.leaves[0].reason, "Second employee's leave");
  });

it("does not return the admin's own or other employees' leave to an employee", async () => {
    // Forged `role=admin` must not widen the scope. The correct outcome is
    // "the caller's own records", not necessarily "no records" - empT has
    // leave of their own from the earlier suite.
    const forged = await api("GET", `/leave/${otherEmpRec}/admin`, { token: empT });
    assert.equal(forged.status, 200);
    assert.ok(
      !forged.body.leaves.some((l) => l._id === otherLeaveId),
      "forged role=admin leaked another employee's leave"
    );

    // Every returned record must belong to the caller.
    const own = await api("GET", `/leave/${ids.empRec}/employee`, { token: empT });
    assert.deepEqual(
      forged.body.leaves.map((l) => l._id).sort(),
      own.body.leaves.map((l) => l._id).sort()
    );

    // And the other employee with a forged role still gets only their own.
    const swapped = await api("GET", `/leave/${otherEmpRec}/admin`, { token: otherEmpT });
    assert.equal(swapped.status, 200);
    assert.deepEqual(
      swapped.body.leaves.map((l) => l._id),
      [otherLeaveId]
    );
  });

  it("scopes an employee's leave list to their token regardless of the id", async () => {
    // otherEmpT asks for empRec's id; they must still get only their own rows.
    const r = await api("GET", `/leave/${ids.empRec}/employee`, { token: otherEmpT });
    assert.equal(r.status, 200);
    assert.deepEqual(
      r.body.leaves.map((l) => l._id),
      [otherLeaveId]
    );
  });

  /* ------------------------------ salary ---------------------------- */

  it("gives an admin exactly the selected employee's payroll", async () => {
    const Salary = (await import("../models/Salary.js")).default;
    await Salary.create({
      employeeId: otherEmpRec,
      basicSalary: 40000,
      allowances: 500,
      deductions: 100,
      netSalary: 40400,
      payDate: new Date("2027-04-01"),
    });

    const r = await api("GET", `/salary/${otherEmpRec}/admin?scope=admin`, { token: adminT });
    assert.equal(r.status, 200);
    assert.equal(r.body.salary.length, 1);
    assert.equal(r.body.salary[0].netSalary, 40400);
  });

  it("returns 404 for an admin asking for a non-existent employee", async () => {
    const r = await api("GET", "/salary/000000000000000000000000/admin?scope=admin", {
      token: adminT,
    });
    assert.equal(r.status, 404);
  });

  /* ---------------------------- attendance -------------------------- */

  it("scopes the admin attendance board to one employee", async () => {
    const r = await api("GET", `/attendance?employeeId=${otherEmpRec}`, { token: adminT });
    assert.equal(r.status, 200);
    const rows = r.body.attendance;
    assert.ok(Array.isArray(rows));
    // Only the requested employee's rows, even though other employees exist.
    assert.ok(rows.length > 0, "expected rows for the selected employee");
    assert.ok(
      rows.every((row) => String(row.employeeId?._id ?? row.employeeId) === otherEmpRec),
      "attendance leaked rows belonging to another employee"
    );
  });

  it("forbids an employee reading the attendance board", async () => {
    const r = await api("GET", "/attendance", { token: empT });
    assert.equal(r.status, 403);
  });
});

describe("forged work-request role", () => {
  it("does not let a client widen the scope with role=admin in the URL", async () => {
    // A second client, so cross-client leakage is actually observable.
    const bcrypt = (await import("bcrypt")).default;
    const hash = await bcrypt.hash(PASSWORD, 10);
    const user = await User.create({
      name: "Cli2",
      email: "cli2@test.local",
      password: hash,
      role: "client",
    });
    const Client = (await import("../models/Client.js")).default;
    const rec = await Client.create({ userId: user._id, entityType: "legal", companyName: "Other Co" });
    const WorkRequest = (await import("../models/Work.js")).default;
    await WorkRequest.create({
      clientId: rec._id,
      name: "Someone else's request",
      requestType: "Civil",
      startDate: new Date("2027-06-01"),
      endDate: new Date("2027-06-04"),
      details: "Should never be visible to cli@test.local",
      status: "Pending",
    });
    const cli2T = await loginAs("cli2@test.local", PASSWORD);

    const forged = await api("GET", `/work-request/${rec._id}/admin`, { token: cliT });
    assert.equal(forged.status, 403, "forged role=admin bypassed the ownership check");

    const own = await api("GET", `/work-request/${rec._id}/client`, { token: cli2T });
    assert.equal(own.status, 200);
    assert.equal(own.body.requests.length, 1);
  });
});

after(() => {
  if (mongoose.connection.readyState !== 0) {
    /* disconnectTestDb already ran; nothing to do */
  }
});