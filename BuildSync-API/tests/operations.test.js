import { before, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

import {
  connectTestDb,
  disconnectTestDb,
  startApp,
  stopApp,
  api,
  base,
  loginAs,
} from "./helpers.js";

import User from "../models/User.js";
import Employee from "../models/Employee.js";
import Department from "../models/Department.js";
import Client from "../models/Client.js";
import WorkRequest from "../models/Work.js";
import Notification from "../models/Notification.js";
import Project from "../models/Project.js";
import Invoice from "../models/Invoice.js";
import Material from "../models/Material.js";
import { PRIVATE_DOCUMENT_DIR, UPLOAD_DIR } from "../middleware/multerConfig.js";
import { toCsv } from "../utils/csv.js";
import { businessDate } from "../middleware/defaultAttendance.js";

const PASSWORD = "Test!Pass123";
const ids = {};
let adminT;
let empT;
let emp2T;
let cliT;
let cli2T;

const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d;
};

async function seed() {
  const bcrypt = (await import("bcrypt")).default;
  const hash = await bcrypt.hash(PASSWORD, 10);

  const site = await Department.create({ dep_name: "Ops Site", description: "Tower A" });
  const otherSite = await Department.create({ dep_name: "Other Site" });

  const admin = await User.create({ name: "Ops Admin", email: "ops-admin@test.local", password: hash, role: "admin" });
  const empUser = await User.create({ name: "Site Engineer", email: "ops-emp@test.local", password: hash, role: "employee" });
  const emp2User = await User.create({ name: "Second Engineer", email: "ops-emp2@test.local", password: hash, role: "employee" });
  const cliUser = await User.create({ name: "Client One", email: "ops-cli@test.local", password: hash, role: "client" });
  const cli2User = await User.create({ name: "Client Two", email: "ops-cli2@test.local", password: hash, role: "client" });

  const emp = await Employee.create({
    userId: empUser._id,
    employeeId: "OPS-001",
    department: site._id,
    designation: "Site Engineer",
    salary: 50000,
  });
  const emp2 = await Employee.create({
    userId: emp2User._id,
    employeeId: "OPS-002",
    department: otherSite._id,
    designation: "Engineer",
    salary: 50000,
  });
  const client = await Client.create({
    userId: cliUser._id,
    entityType: "legal",
    companyName: "Client One Ltd",
  });
  const client2 = await Client.create({
    userId: cli2User._id,
    entityType: "legal",
    companyName: "Client Two Ltd",
  });

  Object.assign(ids, {
    admin: admin._id,
    empUser: empUser._id,
    emp: emp._id,
    emp2,
    cliUser: cliUser._id,
    client: client._id,
    cli2User: cli2User._id,
    client2: client2._id,
    site: site._id,
    otherSite: otherSite._id,
  });
}

before(async () => {
  await connectTestDb();
  await startApp();
  await seed();
  adminT = await loginAs("ops-admin@test.local", PASSWORD);
  empT = await loginAs("ops-emp@test.local", PASSWORD);
  emp2T = await loginAs("ops-emp2@test.local", PASSWORD);
  cliT = await loginAs("ops-cli@test.local", PASSWORD);
  cli2T = await loginAs("ops-cli2@test.local", PASSWORD);
  assert.ok(adminT && empT && emp2T && cliT && cli2T);
});

after(async () => {
  await stopApp();
  await disconnectTestDb();
});

const createProject = async (overrides = {}) => {
  const response = await api("POST", "/project", {
    token: adminT,
    body: {
      name: overrides.name || "Ops Project",
      site: ids.site,
      client: ids.client,
      manager: ids.emp,
      team: [ids.emp],
      startDate: day(-10).toISOString(),
      endDate: day(60).toISOString(),
      contractValue: 1000000,
      estimatedCost: 650000,
      ...overrides,
    },
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  return response.body.project;
};

describe("project execution core", () => {
  it("lets an administrator create a project with budget and team", async () => {
    const project = await createProject({ name: "Tower A" });
    ids.project = project._id;

    assert.equal(project.name, "Tower A");
    assert.ok(project.code);
    assert.equal(project.finance.costToDate, 0);
    assert.equal(project.budget.margin, 1000000);
  });

  it("converts a work request exactly once and rejects a second conversion", async () => {
    const request = await WorkRequest.create({
      clientId: ids.client,
      name: "New warehouse",
      description: "Warehouse shell",
      startDate: day(5),
      endDate: day(80),
      status: "Approved",
    });

    const prefill = await api("GET", `/project/prefill/work-request/${request._id}`, { token: adminT });
    assert.equal(prefill.status, 200);
    assert.equal(prefill.body.draft.client, String(ids.client));

    const first = await api("POST", "/project", {
      token: adminT,
      body: {
        workRequestId: String(request._id),
        site: String(ids.site),
        manager: String(ids.emp),
        estimatedCost: 250000,
        contractValue: 400000,
      },
    });
    assert.equal(first.status, 201, JSON.stringify(first.body));
    assert.equal(first.body.project.name, "New warehouse");

    const reloaded = await WorkRequest.findById(request._id);
    assert.equal(reloaded.status, "Assigned");

    const second = await api("POST", "/project", {
      token: adminT,
      body: { workRequestId: String(request._id), site: String(ids.site) },
    });
    assert.equal(second.status, 409);
    assert.equal(second.body.code, "PROJECT_EXISTS");
  });

  it("hides commercial figures from employees but shows client billing to the client", async () => {
    const asEmployee = await api("GET", `/project/${ids.project}`, { token: empT });
    assert.equal(asEmployee.status, 200);
    assert.equal(asEmployee.body.project.contractValue, undefined);
    assert.equal(asEmployee.body.project.estimatedCost, undefined);
    assert.equal(asEmployee.body.project.finance, undefined);

    const asClient = await api("GET", `/project/${ids.project}`, { token: cliT });
    assert.equal(asClient.status, 200);
    assert.equal(asClient.body.project.estimatedCost, undefined);
    assert.ok(asClient.body.project.finance.billed >= 0);
    assert.equal(asClient.body.project.finance.costToDate, undefined);

    const stranger = await api("GET", `/project/${ids.project}`, { token: cli2T });
    assert.equal(stranger.status, 403);
  });

  it("refuses project writes from non-administrators", async () => {
    const response = await api("POST", "/project", {
      token: empT,
      body: { name: "Unauthorised", site: String(ids.site), startDate: day(0), endDate: day(5) },
    });
    assert.equal(response.status, 403);
  });

  it("refuses to delete a client who still has project or billing history", async () => {
    const response = await api("DELETE", `/client/${ids.client}`, { token: adminT });
    assert.equal(response.status, 409, JSON.stringify(response.body));
    assert.equal(response.body.code, "HISTORICAL_DEPENDENCIES");
    assert.ok(response.body.details.projects > 0);
  });
});

describe("tasks", () => {
  it("lets only the assignee move their task and refuses cross-account edits", async () => {
    const created = await api("POST", "/task", {
      token: adminT,
      body: {
        project: String(ids.project),
        title: "Pour slab",
        assignee: String(ids.emp),
        dueDate: day(3).toISOString(),
        priority: "High",
      },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    ids.task = created.body.task._id;

    const mine = await api("GET", "/task", { token: empT });
    assert.equal(mine.status, 200);
    assert.equal(mine.body.tasks.length, 1);

    const update = await api("PUT", `/task/${ids.task}`, {
      token: empT,
      body: { status: "In Progress", actualHours: 2 },
    });
    assert.equal(update.status, 200);
    assert.equal(update.body.task.status, "In Progress");

    const forbidden = await api("PUT", `/task/${ids.task}`, {
      token: emp2T,
      body: { status: "Done" },
    });
    assert.equal(forbidden.status, 403);

    const field = await api("PUT", `/task/${ids.task}`, {
      token: empT,
      body: { title: "Reassigned by employee" },
    });
    assert.equal(field.status, 403);
    assert.equal(field.body.code, "FORBIDDEN_FIELD");

    const clientRead = await api("GET", "/task", { token: cliT });
    assert.equal(clientRead.status, 403);
  });
});

describe("materials and the append-only stock ledger", () => {
  it("records receipts and issues, and refuses an over-issue", async () => {
    const material = await api("POST", "/material", {
      token: adminT,
      body: { name: "OPC Cement", category: "Concrete", unit: "Bag", unitCost: 380, reorderLevel: 20 },
    });
    assert.equal(material.status, 201, JSON.stringify(material.body));
    ids.material = material.body.material._id;

    const receipt = await api("POST", "/material/movements", {
      token: adminT,
      body: {
        material: String(ids.material),
        site: String(ids.site),
        type: "In",
        quantity: 100,
        unitCost: 380,
        reference: "GRN-1",
      },
    });
    assert.equal(receipt.status, 201, JSON.stringify(receipt.body));
    assert.equal(receipt.body.balanceAfter, 100);

    const overIssue = await api("POST", "/material/movements", {
      token: empT,
      body: {
        material: String(ids.material),
        site: String(ids.site),
        type: "Out",
        quantity: 150,
      },
    });
    assert.equal(overIssue.status, 409);
    assert.equal(overIssue.body.code, "INSUFFICIENT_STOCK");

    const adjustment = await api("POST", "/material/movements", {
      token: empT,
      body: {
        material: String(ids.material),
        site: String(ids.site),
        type: "Adjustment",
        quantity: -5,
        note: "Manual count",
      },
    });
    assert.equal(adjustment.status, 403);
    assert.equal(adjustment.body.code, "FORBIDDEN_ROLE");

    const stock = await api("GET", `/material/${ids.material}/stock?site=${ids.site}`, { token: empT });
    assert.equal(stock.status, 200);
    assert.equal(stock.body.stock.onHand, 100);
  });

  it("keeps the client out of inventory", async () => {
    const response = await api("GET", "/material/stock", { token: cliT });
    assert.equal(response.status, 403);
  });

  it("hides stock valuation and equipment rates from field staff", async () => {
    const stock = await api("GET", "/material/stock", { token: empT });
    assert.equal(stock.status, 200, JSON.stringify(stock.body));
    assert.equal(stock.body.summary.stockValue, undefined);
    assert.ok(stock.body.stock.length > 0);
    assert.ok(stock.body.stock.every((row) => row.stockValue === undefined));
    assert.ok(stock.body.stock.every((row) => row.unitCost === undefined));

    const catalogue = await api("GET", "/material", { token: empT });
    assert.equal(catalogue.status, 200);
    assert.ok(catalogue.body.materials.every((row) => row.unitCost === undefined));
    assert.ok(catalogue.body.materials.every((row) => row.stock?.value === undefined));

    const detail = await api("GET", `/material/${ids.material}/stock?site=${ids.site}`, { token: empT });
    assert.equal(detail.status, 200);
    assert.equal(detail.body.material.unitCost, undefined);

    // An employee cannot set the accounting cost through the request body.
    const movement = await api("POST", "/material/movements", {
      token: empT,
      body: {
        material: String(ids.material),
        site: String(ids.site),
        type: "In",
        quantity: 1,
        unitCost: 1,
      },
    });
    assert.equal(movement.status, 201, JSON.stringify(movement.body));
    assert.equal(movement.body.movement.unitCost, undefined);

    // Restore the balance so the daily-report approval test starts from 100.
    const cleanup = await api("POST", "/material/movements", {
      token: adminT,
      body: {
        material: String(ids.material),
        site: String(ids.site),
        type: "Adjustment",
        quantity: -1,
        note: "Test cleanup",
      },
    });
    assert.equal(cleanup.status, 201, JSON.stringify(cleanup.body));

    const equipment = await api("GET", "/equipment/summary", { token: empT });
    assert.equal(equipment.status, 200);
    assert.equal(equipment.body.summary.rentalValue, 0);
  });
});

describe("daily reports and transactional stock posting", () => {
  it("posts material usage to the ledger exactly once on approval", async () => {
    const created = await api("POST", "/daily-report", {
      token: empT,
      body: {
        project: String(ids.project),
        date: businessDate(),
        workCompleted: "Slab reinforcement completed",
        workforce: { planned: 12, present: 10 },
        materialsUsed: [{ material: String(ids.material), quantity: 10 }],
      },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    ids.report = created.body.report._id;

    const clientDraft = await api("GET", `/daily-report/${ids.report}`, { token: cliT });
    assert.equal(clientDraft.status, 403);
    assert.equal(clientDraft.body.code, "REPORT_NOT_APPROVED");

    const submit = await api("POST", `/daily-report/${ids.report}/submit`, { token: empT });
    assert.equal(submit.status, 200);
    assert.equal(submit.body.report.status, "Submitted");

    const approve = await api("POST", `/daily-report/${ids.report}/approve`, { token: adminT });
    assert.equal(approve.status, 200, JSON.stringify(approve.body));
    assert.equal(approve.body.report.status, "Approved");

    let stock = await api("GET", `/material/${ids.material}/stock?site=${ids.site}`, { token: adminT });
    assert.equal(stock.body.stock.onHand, 90);

    // Re-approving must not deduct a second time.
    const again = await api("POST", `/daily-report/${ids.report}/approve`, { token: adminT });
    assert.equal(again.status, 200);
    stock = await api("GET", `/material/${ids.material}/stock?site=${ids.site}`, { token: adminT });
    assert.equal(stock.body.stock.onHand, 90);

    const clientApproved = await api("GET", `/daily-report/${ids.report}`, { token: cliT });
    assert.equal(clientApproved.status, 200);
    assert.equal(clientApproved.body.report.status, "Approved");

    // Once approved, the report is an audit record: its material usage has
    // already been posted to the append-only ledger and must not diverge.
    const tampered = await api("PUT", `/daily-report/${ids.report}`, {
      token: adminT,
      body: { workCompleted: "Changed after approval", materialsUsed: [] },
    });
    assert.equal(tampered.status, 409, JSON.stringify(tampered.body));
    assert.equal(tampered.body.code, "REPORT_APPROVED_LOCKED");
  });

  it("notifies administrators when a report is submitted", async () => {
    const notes = await Notification.find({ user: ids.admin, type: "Approval" }).lean();
    assert.ok(notes.some((note) => note.title.includes("Daily report")));
  });
});

describe("safety incidents", () => {
  it("accepts the company's today and rejects a future calendar date", async () => {
    const created = await api("POST", "/safety", {
      token: adminT,
      body: {
        title: "Loose scaffold board",
        site: String(ids.site),
        date: businessDate(),
        type: "Near Miss",
        severity: "Low",
        description: "A board was loose at level two; it was secured immediately.",
      },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.incident.status, "Open");

    const future = await api("POST", "/safety", {
      token: adminT,
      body: {
        title: "Future incident",
        site: String(ids.site),
        date: businessDate(day(1)),
        type: "Near Miss",
        severity: "Low",
        description: "This must not be accepted.",
      },
    });
    assert.equal(future.status, 400);
    assert.equal(future.body.code, "INVALID_DATE");

    const update = await api("PUT", `/safety/${created.body.incident._id}`, {
      token: adminT,
      body: { date: businessDate(day(1)) },
    });
    assert.equal(update.status, 400);
    assert.equal(update.body.code, "INVALID_DATE");
  });

  it("scopes employee reports and reads to the employee's own site", async () => {
    const created = await api("POST", "/safety", {
      token: empT,
      body: {
        title: "Employee near miss",
        // Spoofing another site must be ignored; the token decides the site.
        site: String(ids.otherSite),
        type: "Near Miss",
        severity: "Low",
        description: "Pallet fell over in the unloading bay.",
      },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(String(created.body.incident.site._id), String(ids.site));

    const crossRead = await api("GET", `/safety/${created.body.incident._id}`, { token: emp2T });
    assert.equal(crossRead.status, 403);

    const crossWrite = await api("PUT", `/safety/${created.body.incident._id}`, {
      token: emp2T,
      body: { status: "Investigating" },
    });
    assert.equal(crossWrite.status, 403);

    const adminRead = await api("GET", `/safety/${created.body.incident._id}`, { token: adminT });
    assert.equal(adminRead.status, 200);

    const clientDenied = await api("GET", "/safety", { token: cliT });
    assert.equal(clientDenied.status, 403);
  });

  it("enforces the incident state machine and deletion lock", async () => {
    const created = await api("POST", "/safety", {
      token: adminT,
      body: {
        title: "State machine incident",
        site: String(ids.site),
        type: "Unsafe Act",
        severity: "Medium",
        description: "No harness at height.",
      },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const id = created.body.incident._id;

    const resolve = await api("PUT", `/safety/${id}`, { token: adminT, body: { status: "Resolved" } });
    assert.equal(resolve.status, 200, JSON.stringify(resolve.body));

    const backwards = await api("PUT", `/safety/${id}`, { token: adminT, body: { status: "Open" } });
    assert.equal(backwards.status, 409, JSON.stringify(backwards.body));
    assert.equal(backwards.body.code, "INVALID_TRANSITION");

    const locked = await api("DELETE", `/safety/${id}`, { token: adminT });
    assert.equal(locked.status, 409);
    assert.equal(locked.body.code, "INCIDENT_LOCKED");

    const open = await api("POST", "/safety", {
      token: adminT,
      body: {
        title: "Deletable incident",
        site: String(ids.site),
        type: "Near Miss",
        severity: "Low",
        description: "Duplicate report entered by mistake.",
      },
    });
    assert.equal(open.status, 201);
    const removed = await api("DELETE", `/safety/${open.body.incident._id}`, { token: adminT });
    assert.equal(removed.status, 200);
  });
});

describe("expenses, invoices and financial privacy", () => {
  it("records and approves an expense for an administrator only", async () => {
    const denied = await api("GET", "/expense", { token: empT });
    assert.equal(denied.status, 403);

    const created = await api("POST", "/expense", {
      token: adminT,
      body: {
        project: String(ids.project),
        category: "Materials",
        description: "Cement purchase",
        amount: 50000,
        date: day(-1).toISOString(),
        paymentMethod: "Bank Transfer",
      },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    ids.expense = created.body.expense._id;

    const approved = await api("POST", `/expense/${ids.expense}/approve`, { token: adminT });
    assert.equal(approved.status, 200);
    assert.equal(approved.body.expense.status, "Approved");

    const summary = await api("GET", "/expense/summary", { token: adminT });
    assert.equal(summary.status, 200);
    assert.equal(summary.body.summary.costToDate, 50000);
  });

  it("derives invoice status from payments and keeps employee access closed", async () => {
    const created = await api("POST", "/invoice", {
      token: adminT,
      body: {
        project: String(ids.project),
        issueDate: day(-5).toISOString(),
        dueDate: day(15).toISOString(),
        lineItems: [{ description: "Mobilisation", quantity: 1, unit: "Lot", rate: 200000 }],
        taxRate: 18,
        notes: "Progress invoice 1",
      },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    ids.invoice = created.body.invoice._id;
    assert.equal(created.body.invoice.status, "Draft");

    const sent = await api("POST", `/invoice/${ids.invoice}/send`, { token: adminT });
    assert.equal(sent.status, 200);
    assert.equal(sent.body.invoice.status, "Sent");

    const payment = await api("POST", `/invoice/${ids.invoice}/payments`, {
      token: adminT,
      body: { amount: 100000, method: "UPI", reference: "TXN-1" },
    });
    assert.equal(payment.status, 200);
    assert.equal(payment.body.invoice.status, "Partially Paid");
    assert.equal(payment.body.invoice.amountPaid, 100000);

    const clientList = await api("GET", "/invoice", { token: cliT });
    assert.equal(clientList.status, 200);
    assert.equal(clientList.body.invoices.length, 1);

    const otherClientList = await api("GET", "/invoice", { token: cli2T });
    assert.equal(otherClientList.status, 200);
    assert.equal(otherClientList.body.invoices.length, 0);

    const employeeList = await api("GET", "/invoice", { token: empT });
    assert.equal(employeeList.status, 403);

    const summary = await api("GET", "/invoice/summary", { token: cliT });
    assert.equal(summary.status, 200);
    assert.equal(summary.body.summary.billed, 236000);
    assert.equal(summary.body.summary.outstanding, 136000);
  });

  it("rejects overpayment and stale edits after money is recorded", async () => {
    const overpayment = await api("POST", `/invoice/${ids.invoice}/payments`, {
      token: adminT,
      body: { amount: 200000, method: "UPI", reference: "TXN-OVER" },
    });
    assert.equal(overpayment.status, 400, JSON.stringify(overpayment.body));
    assert.equal(overpayment.body.code, "OVERPAYMENT");

    const invoice = await api("GET", `/invoice/${ids.invoice}`, { token: adminT });
    assert.equal(invoice.status, 200);
    assert.equal(invoice.body.invoice.amountPaid, 100000);
    assert.equal(invoice.body.invoice.payments.length, 1);

    const edit = await api("PUT", `/invoice/${ids.invoice}`, {
      token: adminT,
      body: { notes: "Overwrite after payment" },
    });
    assert.equal(edit.status, 409, JSON.stringify(edit.body));
    assert.equal(edit.body.code, "INVOICE_LOCKED");

    const resend = await api("POST", `/invoice/${ids.invoice}/send`, { token: adminT });
    assert.equal(resend.status, 409);

    const cancel = await api("POST", `/invoice/${ids.invoice}/cancel`, { token: adminT });
    assert.equal(cancel.status, 409);
    assert.equal(cancel.body.code, "INVOICE_HAS_PAYMENTS");
  });

  it("refuses to hard-delete a project with retained field or billing history", async () => {
    const response = await api("DELETE", `/project/${ids.project}`, { token: adminT });
    assert.equal(response.status, 409, JSON.stringify(response.body));
    assert.equal(response.body.code, "HISTORICAL_DEPENDENCIES");
  });
});

describe("private document vault", () => {
  it("streams a document only to a caller who may see it", async () => {
    const form = new FormData();
    form.append("project", String(ids.project));
    form.append("category", "Contract");
    form.append("name", "Signed contract");
    form.append("isClientVisible", "true");
    form.append("file", new Blob(["contract body"], { type: "text/plain" }), "contract.txt");

    const upload = await fetch(`${base()}/document`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminT}` },
      body: form,
    });
    assert.equal(upload.status, 201);
    const body = await upload.json();
    ids.document = body.document._id;
    assert.equal(body.document.name, "Signed contract");

    const stored = body.document.filename;
    assert.ok(fs.existsSync(path.join(PRIVATE_DOCUMENT_DIR, stored)));
    assert.ok(!fs.existsSync(path.join(UPLOAD_DIR, stored)));

    const client = await fetch(`${base()}/document/${ids.document}/download`, {
      headers: { Authorization: `Bearer ${cliT}` },
    });
    assert.equal(client.status, 200);
    assert.equal(await client.text(), "contract body");

    const stranger = await fetch(`${base()}/document/${ids.document}/download`, {
      headers: { Authorization: `Bearer ${cli2T}` },
    });
    assert.equal(stranger.status, 403);

    const anonymous = await fetch(`${base()}/document/${ids.document}/download`);
    assert.equal(anonymous.status, 401);

    // A site-only document stays internal even if its project belongs to the
    // client. The client may not discover or download it directly.
    const internalForm = new FormData();
    internalForm.append("project", String(ids.project));
    internalForm.append("category", "Permit");
    internalForm.append("name", "Internal permit");
    internalForm.append("isClientVisible", "false");
    internalForm.append("file", new Blob(["internal body"], { type: "text/plain" }), "internal.txt");
    const internalUpload = await fetch(`${base()}/document`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminT}` },
      body: internalForm,
    });
    assert.equal(internalUpload.status, 201);
    const internalBody = await internalUpload.json();
    ids.internalDocument = internalBody.document._id;
    assert.equal(internalBody.document.isClientVisible, false);

    const internalMeta = await api("GET", `/document/${ids.internalDocument}`, { token: cliT });
    assert.equal(internalMeta.status, 403);
    assert.equal(internalMeta.body.code, "FORBIDDEN_DOCUMENT");
    const internalDownload = await fetch(`${base()}/document/${ids.internalDocument}/download`, {
      headers: { Authorization: `Bearer ${cliT}` },
    });
    assert.equal(internalDownload.status, 403);

    // A client upload belongs to their own project and is always visible to
    // them, without allowing them to publish a site-only internal file.
    const clientForm = new FormData();
    clientForm.append("project", String(ids.project));
    clientForm.append("category", "Report");
    clientForm.append("name", "Client evidence");
    clientForm.append("file", new Blob(["client body"], { type: "text/plain" }), "client.txt");
    const clientUpload = await fetch(`${base()}/document`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cliT}` },
      body: clientForm,
    });
    assert.equal(clientUpload.status, 201, await clientUpload.clone().text());
    const clientBody = await clientUpload.json();
    ids.clientDocument = clientBody.document._id;
    assert.equal(clientBody.document.isClientVisible, true);

    const clientDownload = await fetch(`${base()}/document/${ids.clientDocument}/download`, {
      headers: { Authorization: `Bearer ${cliT}` },
    });
    assert.equal(clientDownload.status, 200);
    assert.equal(await clientDownload.text(), "client body");

    const adminList = await api("GET", "/document?limit=100", { token: adminT });
    assert.equal(adminList.status, 200);
    assert.ok(adminList.body.documents.some((doc) => doc._id === String(ids.clientDocument)));
  });
});

describe("notifications", () => {
  it("scopes reads to the signed-in user and marks everything read", async () => {
    const list = await api("GET", "/notification", { token: empT });
    assert.equal(list.status, 200);
    assert.ok(list.body.notifications.length > 0);
    assert.ok(list.body.notifications.every((n) => String(n.user) === String(ids.empUser)));

    const adminNotice = await Notification.findOne({ user: ids.admin }).lean();
    const denied = await api("POST", `/notification/${adminNotice._id}/read`, { token: empT });
    assert.equal(denied.status, 404);

    const readAll = await api("POST", "/notification/read-all", { token: empT });
    assert.equal(readAll.status, 200);

    const unread = await api("GET", "/notification/unread-count", { token: empT });
    assert.equal(unread.body.unread, 0);
  });
});

describe("grounded assistant", () => {
  it("answers from live data and refuses commercial detail to an employee", async () => {
    const admin = await api("POST", "/assistant/chat", {
      token: adminT,
      body: { message: "What is outstanding from clients?" },
    });
    assert.equal(admin.status, 200, JSON.stringify(admin.body));
    assert.equal(admin.body.grounded, true);
    assert.match(admin.body.reply, /Outstanding/i);

    const employee = await api("POST", "/assistant/chat", {
      token: empT,
      body: { message: "How much is outstanding from clients?" },
    });
    assert.equal(employee.status, 200);
    assert.match(employee.body.reply, /administrators/i);
    assert.doesNotMatch(employee.body.reply, /₹/);
  });

  it("does not mistake the 'hi' inside 'which' for a greeting", async () => {
    const response = await api("POST", "/assistant/chat", {
      token: adminT,
      body: { message: "Which materials are low on stock?" },
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.doesNotMatch(response.body.reply, /I'm Benny/i);
    assert.match(response.body.reply, /material|stock/i);
  });

  it("rejects an empty question", async () => {
    const response = await api("POST", "/assistant/chat", { token: empT, body: { message: "  " } });
    assert.equal(response.status, 400);
  });
});

describe("reporting hub", () => {
  it("scopes the overview to the caller's role", async () => {
    const admin = await api("GET", "/report/overview", { token: adminT });
    assert.equal(admin.status, 200);
    assert.equal(admin.body.role, "admin");
    assert.ok(admin.body.overview);

    const employee = await api("GET", "/report/overview", { token: empT });
    assert.equal(employee.status, 200);
    assert.equal(employee.body.role, "employee");
    assert.equal(employee.body.overview.finance, undefined);

    const client = await api("GET", "/report/overview", { token: cliT });
    assert.equal(client.status, 200);
    assert.equal(client.body.role, "client");
  });

  it("streams a hardened CSV export to administrators only", async () => {
    const denied = await api("GET", "/report/export/projects", { token: empT });
    assert.equal(denied.status, 403);
    const deniedClient = await api("GET", "/report/export/invoices", { token: cliT });
    assert.equal(deniedClient.status, 403);

    const response = await fetch(`${base()}/report/export/projects`, {
      headers: { Authorization: `Bearer ${adminT}` },
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") || "", /text\/csv/);
    assert.match(response.headers.get("content-disposition") || "", /attachment; filename="projects-\d{4}-\d{2}-\d{2}\.csv"/);

    // `fetch` strips the UTF-8 BOM while decoding, so assert from the header row.
    const text = await response.text();
    assert.ok(text.startsWith("Code,Name,Status"));
    assert.ok(text.includes("Tower A"));

    const unknown = await api("GET", "/report/export/nonsense", { token: adminT });
    assert.equal(unknown.status, 400);
    assert.equal(unknown.body.code, "INVALID_EXPORT_TYPE");
  });
});

describe("CSV hardening", () => {
  it("quotes RFC 4180 characters and neutralises formulas", () => {
    const csv = toCsv(
      [{ name: '=HYPERLINK("http://evil")', note: 'a,b\n"c"' }],
      [
        { label: "Name", key: "name" },
        { label: "Note", key: "note" },
      ]
    );
    assert.ok(csv.startsWith("Name,Note\r\n"));
    assert.ok(csv.includes(`"'=HYPERLINK(""http://evil"")"`));
    assert.ok(csv.includes(`"a,b\n""c"""`));
  });
});

describe("audit trail", () => {
  it("is administrator-only and records the project lifecycle", async () => {
    const denied = await api("GET", "/audit", { token: empT });
    assert.equal(denied.status, 403);

    const response = await api("GET", `/audit?entityType=Project&entityId=${ids.project}`, { token: adminT });
    assert.equal(response.status, 200);
    const actions = response.body.events.map((event) => event.action);
    assert.ok(actions.includes("project.created"));

    const history = await api("GET", `/audit/entity/Project/${ids.project}`, { token: adminT });
    assert.equal(history.status, 200);
    assert.ok(history.body.events.length > 0);
  });
});

describe("cleanup", () => {
  it("removes the private test file", async () => {
    for (const id of [ids.document, ids.internalDocument, ids.clientDocument].filter(Boolean)) {
      const doc = await api("GET", `/document/${id}`, { token: adminT });
      const file = doc.body.document?.filename;
      if (file) await fs.promises.unlink(path.join(PRIVATE_DOCUMENT_DIR, file)).catch(() => {});
    }
    await Promise.all([
      Invoice.deleteMany({}),
      Project.deleteMany({}),
      Material.deleteMany({}),
    ]);
  });
});
