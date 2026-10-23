import mongoose from "mongoose";
import bcrypt from "bcrypt";
import fs from "fs";
import path from "path";

await mongoose.connect(process.env.MONGODB_URL);

const User = (await import("./models/User.js")).default;
const Employee = (await import("./models/Employee.js")).default;
const Client = (await import("./models/Client.js")).default;
const Department = (await import("./models/Department.js")).default;
const Leave = (await import("./models/Leave.js")).default;
const WorkRequest = (await import("./models/Work.js")).default;
const Salary = (await import("./models/Salary.js")).default;
const Project = (await import("./models/Project.js")).default;
const Task = (await import("./models/Task.js")).default;
const Material = (await import("./models/Material.js")).default;
const StockMovement = (await import("./models/StockMovement.js")).default;
const Vendor = (await import("./models/Vendor.js")).default;
const Expense = (await import("./models/Expense.js")).default;
const Invoice = (await import("./models/Invoice.js")).default;
const Equipment = (await import("./models/Equipment.js")).default;
const SafetyIncident = (await import("./models/SafetyIncident.js")).default;
const DocumentFile = (await import("./models/DocumentFile.js")).default;
const Notification = (await import("./models/Notification.js")).default;
const Organization = (await import("./models/Organization.js")).default;
const DailyReport = (await import("./models/DailyReport.js")).default;
const AuditEvent = (await import("./models/AuditEvent.js")).default;
const { recordAudit } = await import("./services/auditService.js");


const hash = await bcrypt.hash("Qa!Pass123", 10);
const day = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Idempotent: re-running updates in place instead of duplicating.
async function upsertUser(email, patch) {
  return User.findOneAndUpdate({ email }, { $set: { password: hash, ...patch } }, { upsert: true, new: true, setDefaultsOnInsert: true });
}
async function upsertEmployee(employeeId, patch) {
  return Employee.findOneAndUpdate({ employeeId }, { $set: patch }, { upsert: true, new: true, setDefaultsOnInsert: true });
}

const siteA = await Department.findOneAndUpdate(
  { dep_name: "UI Site Alpha" },
  { $set: { description: "Residential tower - Phase 1", isArchived: false } },
  { upsert: true, new: true, setDefaultsOnInsert: true }
);
const siteB = await Department.findOneAndUpdate(
  { dep_name: "UI Site Beta" },
  { $set: { description: "Commercial complex - Foundations", isArchived: false } },
  { upsert: true, new: true, setDefaultsOnInsert: true }
);

const admin = await upsertUser("admin@uitest.test", { name: "Aarav Sharma", role: "admin" });
const cliUser = await upsertUser("cli@uitest.test", { name: "Priya Constructions", role: "client" });
const e1 = await upsertUser("emp@uitest.test", { name: "Rohan Verma", role: "employee" });
const e2 = await upsertUser("emp2@uitest.test", { name: "Kavita Nair", role: "employee" });
const e3 = await upsertUser("emp3@uitest.test", { name: "Imran Qureshi", role: "employee" });

await upsertEmployee("UI-1001", { userId: e1._id, department: siteA._id, designation: "Site Engineer", dob: day(-2400), salary: 62000, isActive: true });
await upsertEmployee("UI-1002", { userId: e2._id, department: siteB._id, designation: "Quantity Surveyor", dob: day(-1800), salary: 54000, isActive: true });
await upsertEmployee("UI-1003", { userId: e3._id, department: siteA._id, designation: "Safety Officer", dob: day(-1200), salary: 48000, isActive: true });

await Client.findOneAndUpdate(
  { userId: cliUser._id },
  { $set: { entityType: "legal", companyName: "Priya Constructions", phone: "+91 98200 11223", address: "Bandra East, Mumbai" } },
  { upsert: true, new: true, setDefaultsOnInsert: true }
);

// A spread of real statuses so the dashboard breakdown is not all zeros.
const leaves = [
  ["Casual Leave", 2, 3, "Pending", "Family function out of town."],
  ["Annual Leave", 5, 9, "Pending", "Annual family holiday."],
  ["Sick Leave", -6, -5, "Approved", "Viral fever; doctor advised rest."],
  ["Casual Leave", -12, -12, "Approved", "Personal errand."],
  ["Annual Leave", -24, -20, "Rejected", "Extended break during a project deadline."],
];
for (const [leaveType, from, to, status, reason] of leaves) {
  const employee = await Employee.findOne({ employeeId: "UI-1001" });
  const startDate = day(from);
  // Deduplicate on the actual leave dates rather than on the human-readable
  // reason, so changing demo copy cannot create duplicate applications.
  const exists = await Leave.findOne({ employeeId: employee._id, leaveType, startDate });
  if (exists) continue;
  await Leave.create({
    employeeId: employee._id,
    leaveType,
    startDate,
    endDate: day(to),
    reason,
    status,
    // Applied a few days before the leave, but never in the future for a
    // future-dated request.
    appliedAt: day(Math.min(0, from - 3)),
  });
}

const works = [
  [
    "Tower crane installation",
    "Equipment",
    "Pending",
    "Install and commission the tower crane serving the Tower Alpha core.",
  ],
  [
    "Podium slab pour",
    "Civil",
    "Pending",
    "Pour the podium slab and complete the initial curing cycle.",
  ],
  [
    "Steel shuttering supply",
    "Materials",
    "Under Review",
    "Supply steel shuttering panels for the Level 9 slab cycle.",
  ],
  [
    "Site hoarding repair",
    "Civil",
    "Approved",
    "Repair the damaged site hoarding along the eastern boundary.",
  ],
  [
    "MEP duct routing",
    "MEP",
    "In Progress",
    "Route the MEP ducts through the podium service corridor.",
  ],
];
for (const [name, requestType, status, description] of works) {
  const exists = await WorkRequest.findOne({ name });
  if (exists) continue;
  await WorkRequest.create({
    clientId: (await Client.findOne({ userId: cliUser._id }))._id,
    name,
    requestType,
    entityType: "legal",
    startDate: day(3),
    endDate: day(10),
    description,
    status,
    appliedAt: day(-1),
  });
}

// Net pay must equal basic + allowances - deductions; keep the demo payroll
// internally consistent so the dashboard cannot teach the wrong arithmetic.
const salarySeeds = [
  ["UI-1001", 52000, 58000, day(-30)],
  ["UI-1002", 45000, 51000, day(-30)],
];
for (const [employeeId, basic, net, payDate] of salarySeeds) {
  const emp = await Employee.findOne({ employeeId });
  const exists = await Salary.findOne({ employeeId: emp._id, payDate });
  if (exists) continue;
  await Salary.create({ employeeId: emp._id, basicSalary: basic, allowances: 8000, deductions: 2000, netSalary: net, payDate });
}

/* --------------------------------------------------------- operations data */

const clientDoc = await Client.findOne({ userId: cliUser._id });
const staff1 = await Employee.findOne({ employeeId: "UI-1001" });
const staff2 = await Employee.findOne({ employeeId: "UI-1002" });
const staff3 = await Employee.findOne({ employeeId: "UI-1003" });

await Organization.findOneAndUpdate(
  { key: "default" },
  {
    $set: {
      name: "Builtra Construction",
      legalName: "Builtra Infrastructure Pvt Ltd",
      email: "hello@builtra.example",
      phone: "+91 22 4000 1200",
      website: "https://builtra.example",
      address: "Unit 402, Trade Centre, Bandra Kurla Complex, Mumbai 400051",
      gstin: "27AABCB1234C1ZX",
      currency: "INR",
      taxRate: 18,
      invoicePrefix: "INV",
      projectPrefix: "PRJ",
      invoiceTerms: "Payment due within 30 days. Interest at 1.5% per month applies to overdue amounts.",
    },
  },
  { upsert: true, new: true, setDefaultsOnInsert: true }
);

const vendorSeeds = [
  { name: "UltraTech Supplies", category: "Materials", contactName: "Nitin Rao", email: "nitin@ultratech.example", phone: "+91 98200 44556", gstin: "27AABCT5678D1Z2", rating: 5, address: "Vasai East, Palghar" },
  { name: "Skyline Equipment Rentals", category: "Equipment", contactName: "Meera Iyer", email: "meera@skyline.example", phone: "+91 98330 77889", gstin: "27AACCS9012E1Z3", rating: 4, address: "Andheri East, Mumbai" },
  { name: "Sunrise Steel Traders", category: "Materials", contactName: "Prakash Shetty", email: "prakash@sunrisesteel.example", phone: "+91 98670 11223", gstin: "27AAECS3456F1Z4", rating: 4, address: "Kalamboli, Navi Mumbai" },
  { name: "Metro Haulage", category: "Transport", contactName: "Farhan Khan", email: "farhan@metrohaulage.example", phone: "+91 90040 55667", rating: 3, address: "Bhiwandi, Thane" },
];
const vendorDocs = {};
for (const vendor of vendorSeeds) {
  vendorDocs[vendor.name] = await Vendor.findOneAndUpdate(
    { name: vendor.name },
    { $set: { ...vendor, isActive: true } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

const materialSeeds = [
  { sku: "MAT-UI-001", name: "OPC 53 Grade Cement", category: "Concrete", unit: "Bag", unitCost: 420, reorderLevel: 120, preferredVendor: "UltraTech Supplies", description: "50 kg bags for structural concrete." },
  { sku: "MAT-UI-002", name: "TMT Steel Bar 12 mm", category: "Steel", unit: "MT", unitCost: 62500, reorderLevel: 8, preferredVendor: "Sunrise Steel Traders", description: "Fe500D reinforcement steel." },
  { sku: "MAT-UI-003", name: "Red Clay Bricks", category: "Masonry", unit: "Piece", unitCost: 9, reorderLevel: 5000, preferredVendor: "UltraTech Supplies", description: "Class 1 bricks for infill walls." },
  { sku: "MAT-UI-004", name: "River Sand", category: "Masonry", unit: "CFT", unitCost: 62, reorderLevel: 800, preferredVendor: "Metro Haulage", description: "Washed river sand for plaster and concrete." },
  { sku: "MAT-UI-005", name: "PVC Conduit 25 mm", category: "Electrical", unit: "Meter", unitCost: 38, reorderLevel: 300, preferredVendor: "UltraTech Supplies", description: "Rigid PVC conduit for slab conduiting." },
  { sku: "MAT-UI-006", name: "Safety Helmet", category: "Safety", unit: "Piece", unitCost: 320, reorderLevel: 40, preferredVendor: "UltraTech Supplies", description: "IS 2925 certified industrial helmet." },
];
const materialDocs = {};
for (const material of materialSeeds) {
  materialDocs[material.sku] = await Material.findOneAndUpdate(
    { sku: material.sku },
    {
      $set: {
        ...material,
        preferredVendor: vendorDocs[material.preferredVendor]?._id,
        isActive: true,
        createdBy: admin._id,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

const projectSeeds = [
  {
    code: "PRJ-UI-001",
    name: "Tower Alpha - Residential",
    description: "G+18 residential tower with two basement levels and a clubhouse podium.",
    site: siteA._id,
    client: clientDoc._id,
    manager: staff1._id,
    team: [staff1._id, staff3._id],
    status: "In Progress",
    priority: "High",
    health: "On Track",
    startDate: day(-150),
    endDate: day(260),
    contractValue: 42500000,
    estimatedCost: 33800000,
    progress: 46,
    tags: ["residential", "tower", "phase-1"],
    milestones: [
      { title: "Piling and foundation", dueDate: day(-90), status: "Completed", completedAt: day(-92), weight: 20 },
      { title: "Basement structure", dueDate: day(-20), status: "Completed", completedAt: day(-18), weight: 20 },
      { title: "Level 8 slab", dueDate: day(25), status: "In Progress", weight: 25 },
      { title: "Facade and glazing", dueDate: day(150), status: "Pending", weight: 20 },
      { title: "Handover", dueDate: day(255), status: "Pending", weight: 15 },
    ],
  },
  {
    code: "PRJ-UI-002",
    name: "Commercial Block B",
    description: "Retail podium and seven-storey office block with basement parking.",
    site: siteB._id,
    client: clientDoc._id,
    manager: staff2._id,
    team: [staff2._id, staff3._id],
    status: "Mobilisation",
    priority: "Normal",
    health: "At Risk",
    startDate: day(-35),
    endDate: day(340),
    contractValue: 58750000,
    estimatedCost: 49200000,
    progress: 12,
    tags: ["commercial", "retail"],
    milestones: [
      { title: "Site handover and fencing", dueDate: day(-10), status: "Completed", completedAt: day(-9), weight: 10 },
      { title: "Excavation and shoring", dueDate: day(45), status: "In Progress", weight: 30 },
      { title: "Foundation", dueDate: day(110), status: "Pending", weight: 30 },
      { title: "Structure completion", dueDate: day(290), status: "Pending", weight: 30 },
    ],
  },
  {
    code: "PRJ-UI-003",
    name: "Alpha Clubhouse Fitout",
    description: "Interior fitout of the clubhouse, lobby and sample apartment.",
    site: siteA._id,
    client: clientDoc._id,
    manager: staff1._id,
    team: [staff1._id, staff2._id],
    status: "Planning",
    priority: "Low",
    health: "Delayed",
    startDate: day(-8),
    endDate: day(120),
    contractValue: 9800000,
    estimatedCost: 7600000,
    progress: 4,
    tags: ["fitout", "interiors"],
    milestones: [
      { title: "Design freeze", dueDate: day(10), status: "In Progress", weight: 30 },
      { title: "Mock-up apartment", dueDate: day(55), status: "Pending", weight: 30 },
      { title: "Complete fitout", dueDate: day(115), status: "Pending", weight: 40 },
    ],
  },
];
const projectDocs = {};
for (const project of projectSeeds) {
  projectDocs[project.code] = await Project.findOneAndUpdate(
    { code: project.code },
    { $set: { ...project, createdBy: admin._id, currency: "INR", isArchived: false } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

const taskSeeds = [
  ["PRJ-UI-001", "Pour level 8 slab", staff1._id, "In Progress", "High", -2, 6, 48, 30, "Ready-mix booked for Thursday morning."],
  ["PRJ-UI-001", "Inspect shuttering before pour", staff1._id, "To Do", "Critical", -1, 2, 6, 0, "Joint check with the structural consultant."],
  ["PRJ-UI-001", "Reconcile cement consumption", staff1._id, "Done", "Normal", -8, -4, 8, 7, "Matched against the daily report."],
  ["PRJ-UI-001", "Update safety induction register", staff3._id, "In Progress", "Normal", -3, 3, 5, 2, ""],
  ["PRJ-UI-001", "Order facade samples", staff1._id, "Blocked", "High", -6, 12, 4, 0, "Awaiting client selection of finish."],
  ["PRJ-UI-002", "Complete excavation to -4.5 m", staff2._id, "In Progress", "High", -10, 15, 80, 34, "Two excavators deployed."],
  ["PRJ-UI-002", "Submit shoring design", staff2._id, "Done", "Critical", -18, -6, 16, 18, ""],
  ["PRJ-UI-002", "Set up site office and utilities", staff2._id, "Done", "Normal", -25, -14, 12, 10, ""],
  ["PRJ-UI-002", "Procure anti-termite treatment", staff3._id, "To Do", "Normal", 2, 10, 4, 0, ""],
  ["PRJ-UI-003", "Freeze clubhouse layout", staff1._id, "In Progress", "High", -5, 8, 12, 4, "Client review on Friday."],
  ["PRJ-UI-003", "Prepare fitout BOQ", staff2._id, "To Do", "Normal", 3, 14, 20, 0, ""],
];
for (const [projectCode, title, assignee, status, priority, startOffset, dueOffset, estimatedHours, actualHours, notes] of taskSeeds) {
  await Task.findOneAndUpdate(
    { project: projectDocs[projectCode]._id, title },
    {
      $set: {
        project: projectDocs[projectCode]._id,
        title,
        assignee,
        status,
        priority,
        startDate: day(startOffset),
        dueDate: day(dueOffset),
        completedAt: status === "Done" ? day(dueOffset) : undefined,
        estimatedHours,
        actualHours,
        notes,
        createdBy: admin._id,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

const stockSeeds = [
  ["SEED-OPEN-CEMENT-A", "MAT-UI-001", siteA._id, "In", 900, "Opening stock", "Opening", day(-120)],
  ["SEED-OPEN-STEEL-A", "MAT-UI-002", siteA._id, "In", 42, "Opening stock", "Opening", day(-120)],
  ["SEED-OPEN-BRICKS-A", "MAT-UI-003", siteA._id, "In", 32000, "Opening stock", "Opening", day(-120)],
  ["SEED-OPEN-SAND-A", "MAT-UI-004", siteA._id, "In", 2200, "Opening stock", "Opening", day(-120)],
  ["SEED-OPEN-CONDUIT-A", "MAT-UI-005", siteA._id, "In", 1400, "Opening stock", "Opening", day(-120)],
  ["SEED-OPEN-HELMET-A", "MAT-UI-006", siteA._id, "In", 90, "Opening stock", "Opening", day(-120)],
  ["SEED-OPEN-CEMENT-B", "MAT-UI-001", siteB._id, "In", 320, "Opening stock", "Opening", day(-30)],
  ["SEED-OPEN-STEEL-B", "MAT-UI-002", siteB._id, "In", 12, "Opening stock", "Opening", day(-30)],
  ["SEED-ISSUE-CEMENT-A", "MAT-UI-001", siteA._id, "Out", 210, "Issued to level 8 pour", "Manual", day(-6)],
  ["SEED-ISSUE-STEEL-A", "MAT-UI-002", siteA._id, "Out", 7.5, "Issued to rebar yard", "Manual", day(-5)],
  ["SEED-ISSUE-BRICKS-A", "MAT-UI-003", siteA._id, "Out", 4200, "Issued to masonry contractor", "Manual", day(-4)],
  ["SEED-ADJ-HELMET-A", "MAT-UI-006", siteA._id, "Adjustment", -3, "Damaged helmets written off after inspection", "Correction", day(-3)],
];
for (const [reference, sku, site, type, quantity, note, source, date] of stockSeeds) {
  const exists = await StockMovement.findOne({ reference });
  if (exists) continue;
  const material = materialDocs[sku];
  await StockMovement.create({
    material: material._id,
    site,
    type,
    quantity,
    unitCost: material.unitCost,
    reference,
    note,
    source,
    date,
    createdBy: admin._id,
  });
}

const reportSeeds = [
  {
    project: "PRJ-UI-001",
    offset: -1,
    weather: "Clear",
    planned: 82,
    present: 76,
    workCompleted: "Level 8 slab reinforcement completed in grid A-D. Electrical conduiting installed and inspected.",
    issues: "One concrete pump arrived two hours late.",
    safetyNotes: "Toolbox talk on working at height completed for 34 workers.",
    status: "Approved",
    materials: [["MAT-UI-001", 20, "Bag"], ["MAT-UI-002", 0.8, "MT"]],
    submittedBy: e1._id,
  },
  {
    project: "PRJ-UI-001",
    offset: 0,
    weather: "Cloudy",
    planned: 85,
    present: 71,
    workCompleted: "Shuttering completed for level 8 slab. Rebar inspection closed with consultant.",
    issues: "Light rain in the afternoon slowed external works.",
    safetyNotes: "Edge protection checked on all working faces.",
    status: "Submitted",
    materials: [],
    submittedBy: e1._id,
  },
  {
    project: "PRJ-UI-001",
    offset: -4,
    weather: "Clear",
    planned: 80,
    present: 78,
    workCompleted: "Level 7 slab pour completed - 184 cum. Curing started under wet gunny bags.",
    issues: "",
    safetyNotes: "No incidents. Night pour lighting inspected.",
    status: "Approved",
    materials: [["MAT-UI-001", 18, "Bag"]],
    submittedBy: e1._id,
  },
  {
    project: "PRJ-UI-002",
    offset: -2,
    weather: "Heavy Rain",
    planned: 45,
    present: 22,
    workCompleted: "Excavation paused for most of the day due to rain. Dewatering pumps deployed.",
    issues: "Standing water in the north-west corner of the excavation.",
    safetyNotes: "Slope stability inspected after rainfall; no movement observed.",
    status: "Approved",
    materials: [],
    submittedBy: e2._id,
  },
  {
    project: "PRJ-UI-002",
    offset: 0,
    weather: "Cloudy",
    planned: 48,
    present: 41,
    workCompleted: "Excavation resumed in grid E-H. Anti-termite layout marked for the western zone.",
    issues: "",
    safetyNotes: "Excavation edges barricaded and illuminated.",
    status: "Draft",
    materials: [],
    submittedBy: e2._id,
  },
];
for (const report of reportSeeds) {
  const date = day(report.offset).toISOString().slice(0, 10);
  const project = projectDocs[report.project];
  const exists = await DailyReport.findOne({ project: project._id, date });
  if (exists) continue;

  const materialsUsed = report.materials.map(([sku, quantity, unit]) => ({
    material: materialDocs[sku]._id,
    quantity,
    unit,
  }));
  const created = await DailyReport.create({
    project: project._id,
    site: project.site,
    date,
    weather: report.weather,
    workforce: { planned: report.planned, present: report.present },
    workCompleted: report.workCompleted,
    issues: report.issues,
    safetyNotes: report.safetyNotes,
    materialsUsed,
    photos: [],
    status: report.status,
    submittedBy: report.submittedBy,
    submittedAt: day(report.offset),
    approvedBy: report.status === "Approved" ? admin._id : undefined,
    approvedAt: report.status === "Approved" ? day(report.offset + 1) : undefined,
    stockApplied: report.status === "Approved" && materialsUsed.length > 0,
    stockAppliedAt: report.status === "Approved" && materialsUsed.length > 0 ? day(report.offset + 1) : undefined,
  });

  if (created.stockApplied) {
    for (const [sku, quantity] of report.materials) {
      await StockMovement.create({
        material: materialDocs[sku]._id,
        site: project.site,
        type: "Out",
        quantity,
        unitCost: materialDocs[sku].unitCost,
        reference: `DPR-${report.project}-${date}`,
        note: `Material usage posted from daily report ${date}`,
        source: "DailyReport",
        sourceId: created._id,
        date: day(report.offset + 1),
        createdBy: admin._id,
      });
    }
  }
}

const expenseSeeds = [
  { reference: "EXP-UI-001", project: "PRJ-UI-001", vendor: "UltraTech Supplies", category: "Materials", description: "Cement supply - 900 bags", amount: 378000, taxAmount: 68040, dateOffset: -32, status: "Paid", paymentMethod: "Bank Transfer", receipt: "seed-receipt-001.pdf" },
  { reference: "EXP-UI-002", project: "PRJ-UI-001", vendor: "Sunrise Steel Traders", category: "Materials", description: "TMT steel reinforcement - 12 MT", amount: 750000, taxAmount: 135000, dateOffset: -24, status: "Approved", paymentMethod: "Bank Transfer" },
  { reference: "EXP-UI-003", project: "PRJ-UI-001", vendor: "Skyline Equipment Rentals", category: "Equipment", description: "Tower crane hire - one month", amount: 540000, taxAmount: 97200, dateOffset: -18, status: "Paid", paymentMethod: "Cheque" },
  { reference: "EXP-UI-004", project: "PRJ-UI-002", vendor: "Metro Haulage", category: "Transport", description: "Excavated spoil removal - 220 trips", amount: 264000, taxAmount: 47520, dateOffset: -12, status: "Pending", paymentMethod: "UPI" },
  { reference: "EXP-UI-005", project: "PRJ-UI-002", vendor: "UltraTech Supplies", category: "Materials", description: "Shoring and dewatering consumables", amount: 186000, taxAmount: 33480, dateOffset: -9, status: "Approved", paymentMethod: "Bank Transfer" },
  { reference: "EXP-UI-006", project: "PRJ-UI-003", vendor: "Skyline Equipment Rentals", category: "Professional Fees", description: "Interior design consultant - concept stage", amount: 125000, taxAmount: 22500, dateOffset: -6, status: "Paid", paymentMethod: "Bank Transfer" },
  { reference: "EXP-UI-007", project: null, vendor: null, category: "Utilities", description: "Head office electricity and internet", amount: 48000, taxAmount: 8640, dateOffset: -3, status: "Paid", paymentMethod: "Card" },
];
for (const expense of expenseSeeds) {
  await Expense.findOneAndUpdate(
    { reference: expense.reference },
    {
      $set: {
        project: expense.project ? projectDocs[expense.project]._id : undefined,
        site: expense.project ? projectDocs[expense.project].site : undefined,
        vendor: expense.vendor ? vendorDocs[expense.vendor]?._id : undefined,
        category: expense.category,
        description: expense.description,
        amount: expense.amount,
        taxAmount: expense.taxAmount,
        totalAmount: expense.amount + expense.taxAmount,
        date: day(expense.dateOffset),
        paymentMethod: expense.paymentMethod,
        reference: expense.reference,
        receipt: expense.receipt,
        status: expense.status,
        createdBy: admin._id,
        approvedBy: ["Approved", "Paid"].includes(expense.status) ? admin._id : undefined,
        approvedAt: ["Approved", "Paid"].includes(expense.status) ? day(expense.dateOffset + 1) : undefined,
        paidAt: expense.status === "Paid" ? day(expense.dateOffset + 2) : undefined,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

const invoiceSeeds = [
  {
    number: "INV-UI-001",
    project: "PRJ-UI-001",
    issueOffset: -40,
    dueOffset: -8,
    items: [{ description: "Basement and podium structure - milestone 2", quantity: 1, unit: "Lot", rate: 2500000 }],
    status: "Partially Paid",
    payments: [{ amount: 1000000, offset: -20, method: "Bank Transfer", reference: "NEFT-884512" }],
    notes: "Milestone certified by the structural consultant.",
  },
  {
    number: "INV-UI-002",
    project: "PRJ-UI-001",
    issueOffset: -70,
    dueOffset: -40,
    items: [
      { description: "Piling and foundation works", quantity: 1, unit: "Lot", rate: 1500000 },
      { description: "Site mobilisation and temporary works", quantity: 1, unit: "Lot", rate: 300000 },
    ],
    status: "Paid",
    payments: [{ amount: 2124000, offset: -45, method: "Bank Transfer", reference: "RTGS-771203" }],
    notes: "Paid in full.",
  },
  {
    number: "INV-UI-003",
    project: "PRJ-UI-002",
    issueOffset: -5,
    dueOffset: 25,
    items: [{ description: "Mobilisation advance - Block B", quantity: 1, unit: "Lot", rate: 800000 }],
    status: "Sent",
    payments: [],
    notes: "Advance invoice as per contract clause 7.2.",
  },
  {
    number: "INV-UI-004",
    project: "PRJ-UI-003",
    issueOffset: 0,
    dueOffset: 30,
    items: [{ description: "Fitout design development - stage 1", quantity: 1, unit: "Lot", rate: 600000 }],
    status: "Draft",
    payments: [],
    notes: "Draft pending internal review.",
  },
];
for (const invoice of invoiceSeeds) {
  const existing = await Invoice.findOne({ number: invoice.number });
  if (existing) continue;
  await Invoice.create({
    number: invoice.number,
    project: projectDocs[invoice.project]._id,
    client: clientDoc._id,
    issueDate: day(invoice.issueOffset),
    dueDate: day(invoice.dueOffset),
    lineItems: invoice.items,
    taxRate: 18,
    discountAmount: 0,
    status: invoice.status,
    payments: invoice.payments.map((payment) => ({
      amount: payment.amount,
      date: day(payment.offset),
      method: payment.method,
      reference: payment.reference,
      recordedBy: admin._id,
    })),
    notes: invoice.notes,
    terms: "Payment due within 30 days of the invoice date.",
    createdBy: admin._id,
    sentAt: invoice.status === "Draft" ? undefined : day(invoice.issueOffset),
  });
}

const equipmentSeeds = [
  { code: "EQ-UI-001", name: "Potain MCT 85 Tower Crane", category: "Lifting", ownership: "Rented", vendor: "Skyline Equipment Rentals", site: siteA._id, project: "PRJ-UI-001", status: "In Use", dailyRate: 18000, operator: staff1._id, lastMaintenance: day(-20), nextMaintenance: day(10), notes: "Monthly hire with operator." },
  { code: "EQ-UI-002", name: "JCB 3DX Backhoe Loader", category: "Earthmoving", ownership: "Owned", site: siteA._id, project: "PRJ-UI-001", status: "In Use", hourlyRate: 1400, purchaseDate: day(-800), purchaseCost: 3100000, lastMaintenance: day(-35), nextMaintenance: day(25), operator: staff3._id },
  { code: "EQ-UI-003", name: "Concrete Batching Plant 30 cum/hr", category: "Concrete", ownership: "Owned", site: siteB._id, project: "PRJ-UI-002", status: "Maintenance", purchaseDate: day(-500), purchaseCost: 7800000, lastMaintenance: day(-2), nextMaintenance: day(28), notes: "Gearbox inspection in progress." },
  { code: "EQ-UI-004", name: "Leica TS16 Total Station", category: "Survey", ownership: "Owned", site: siteA._id, status: "Available", purchaseDate: day(-300), purchaseCost: 850000, lastMaintenance: day(-60), nextMaintenance: day(120) },
];
for (const equipment of equipmentSeeds) {
  await Equipment.findOneAndUpdate(
    { code: equipment.code },
    {
      $set: {
        ...equipment,
        project: equipment.project ? projectDocs[equipment.project]._id : undefined,
        vendor: equipment.vendor ? vendorDocs[equipment.vendor]?._id : undefined,
        createdBy: admin._id,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

const safetySeeds = [
  { title: "Loose scaffolding plank near level 4", project: "PRJ-UI-001", site: siteA._id, dateOffset: -4, type: "Near Miss", severity: "Low", description: "A scaffold plank was found unsecured on the working platform near grid C.", immediateAction: "Plank removed and platform re-inspected before work resumed.", status: "Resolved", reportedBy: e1._id, assignedTo: admin._id },
  { title: "Minor hand injury during rebar cutting", project: "PRJ-UI-001", site: siteA._id, dateOffset: -11, type: "First Aid", severity: "Medium", description: "A steel fixer suffered a laceration to the left hand while handling cut rebar.", immediateAction: "First aid administered on site; worker returned after dressing.", correctiveAction: "Gloves reissued and rebar handling method statement re-briefed.", status: "Investigating", reportedBy: e3._id, assignedTo: admin._id, lostTimeDays: 0 },
  { title: "Open excavation unbarricaded overnight", project: "PRJ-UI-002", site: siteB._id, dateOffset: -20, type: "Unsafe Condition", severity: "High", description: "The north-west excavation edge was left without hard barricading at shift end.", immediateAction: "Area cordoned immediately; night watchman instructed to restrict access.", correctiveAction: "Barricading checklist added to the shift handover.", status: "Closed", reportedBy: e2._id, assignedTo: admin._id, closedAt: day(-17) },
];
for (const incident of safetySeeds) {
  await SafetyIncident.findOneAndUpdate(
    { title: incident.title },
    {
      $set: {
        ...incident,
        project: projectDocs[incident.project]._id,
        photos: [],
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

const documentDir = path.join("private", "documents");
const receiptDir = path.join("private", "receipts");
fs.mkdirSync(documentDir, { recursive: true });
fs.mkdirSync(receiptDir, { recursive: true });
const receiptFile = path.join(receiptDir, "seed-receipt-001.pdf");
if (!fs.existsSync(receiptFile)) {
  fs.writeFileSync(receiptFile, "Builtra demo receipt placeholder\nVendor: UltraTech Supplies\nAmount: INR 446,040\n");
}

const documentSeeds = [
  { project: "PRJ-UI-001", category: "Drawing", name: "Tower Alpha - Level 8 structural drawing", originalName: "tower-alpha-l8-structural.txt", isClientVisible: false, notes: "Issued for construction, revision C." },
  { project: "PRJ-UI-001", category: "Contract", name: "Tower Alpha - client contract", originalName: "tower-alpha-contract.txt", isClientVisible: true, notes: "Executed contract with bill of quantities." },
  { project: "PRJ-UI-002", category: "Permit", name: "Block B - excavation permit", originalName: "block-b-excavation-permit.txt", isClientVisible: false, notes: "Municipal permit valid for six months." },
  { project: "PRJ-UI-002", category: "Report", name: "Block B - geotechnical investigation report", originalName: "block-b-geotech-report.txt", isClientVisible: true, notes: "Soil investigation by external consultant." },
];
for (const document of documentSeeds) {
  const filename = `seed-${document.project.toLowerCase()}-${document.category.toLowerCase()}.txt`;
  const filePath = path.join(documentDir, filename);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, `Builtra demo document\n${document.name}\n`);
  }
  const stat = fs.statSync(filePath);
  await DocumentFile.findOneAndUpdate(
    { project: projectDocs[document.project]._id, name: document.name },
    {
      $set: {
        project: projectDocs[document.project]._id,
        site: projectDocs[document.project].site,
        category: document.category,
        name: document.name,
        filename,
        originalName: document.originalName,
        mimetype: "text/plain",
        size: stat.size,
        notes: document.notes,
        isClientVisible: document.isClientVisible,
        uploadedBy: admin._id,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

const notificationSeeds = [
  [admin._id, "Finance", "Overdue invoice needs follow-up", "INV-UI-001 is past its due date with a balance outstanding.", "/admin-dashboard/invoices"],
  [admin._id, "Safety", "High-severity incident recorded", "An unsafe excavation condition was reported at Commercial Block B.", "/admin-dashboard/safety"],
  [admin._id, "Inventory", "Stock below reorder level", "Cement at UI Site Alpha is below its reorder level.", "/admin-dashboard/inventory"],
  [e1._id, "Assignment", "New task assigned", "Pour level 8 slab is due in six days.", "/employee-dashboard/tasks"],
  [e1._id, "Approval", "Daily report approved", "Your daily report for yesterday has been approved.", "/employee-dashboard/daily-reports"],
  [cliUser._id, "Finance", "Invoice available", "INV-UI-001 has been issued for Tower Alpha - Residential.", "/client-dashboard/invoices"],
  [cliUser._id, "Info", "Project progress update", "Tower Alpha is 46% complete and on track.", "/client-dashboard/projects"],
];
for (const [userId, type, title, message, link] of notificationSeeds) {
  await Notification.findOneAndUpdate(
    { user: userId, title },
    { $set: { user: userId, type, title, message, link } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

/**
 * A populated audit trail so the administrator's audit screen demonstrates
 * the feature immediately. Events carry stable correlation IDs so re-running
 * the seed never duplicates them.
 */
const seedReport = await DailyReport.findOne({
  project: projectDocs["PRJ-UI-001"]._id,
  status: "Approved",
}).sort({ date: -1 });
const seedInvoice = await Invoice.findOne({ number: "INV-UI-001" });
const seedExpense = await Expense.findOne({ reference: "EXP-UI-001" });
const seedIncident = await SafetyIncident.findOne({ title: safetySeeds[0].title });
const seedMovement = await StockMovement.findOne({ reference: "SEED-OPEN-CEMENT-A" });
const seedOrganization = await Organization.findOne();

const auditSeeds = [
  {
    correlationId: "seed-audit-project-created",
    entityType: "Project",
    entityId: projectDocs["PRJ-UI-001"]._id,
    action: "project.created",
    toState: "In Progress",
    reason: "Project created from the approved work request.",
  },
  {
    correlationId: "seed-audit-expense-approved",
    entityType: "Expense",
    entityId: seedExpense?._id,
    action: "expense.updated",
    fromState: "Pending",
    toState: "Approved",
    reason: "Materials invoice verified against the purchase order.",
  },
  {
    correlationId: "seed-audit-invoice-sent",
    entityType: "Invoice",
    entityId: seedInvoice?._id,
    action: "invoice.sent",
    fromState: "Draft",
    toState: "Sent",
    reason: "Milestone invoice issued to the client.",
  },
  {
    correlationId: "seed-audit-invoice-payment",
    entityType: "Invoice",
    entityId: seedInvoice?._id,
    action: "invoice.payment_recorded",
    fromState: "Sent",
    toState: "Partially Paid",
    reason: "Bank transfer received against milestone 2.",
  },
  {
    correlationId: "seed-audit-report-approved",
    entityType: "DailyReport",
    entityId: seedReport?._id,
    action: "daily_report.approved",
    fromState: "Submitted",
    toState: "Approved",
    reason: "Site report verified; material usage posted to the ledger.",
  },
  {
    correlationId: "seed-audit-stock-in",
    entityType: "StockMovement",
    entityId: seedMovement?._id,
    action: "stock.in",
    toState: "In",
    reason: "Opening stock received at UI Site Alpha.",
  },
  {
    correlationId: "seed-audit-safety-reported",
    entityType: "SafetyIncident",
    entityId: seedIncident?._id,
    action: "safety.reported",
    toState: "Resolved",
    reason: "Near miss reported and corrected the same shift.",
  },
  {
    correlationId: "seed-audit-organization",
    entityType: "Organization",
    entityId: seedOrganization?._id,
    action: "organization.updated",
    reason: "Billing defaults and document numbering configured.",
  },
];

for (const event of auditSeeds) {
  if (!event.entityId) continue;
  const exists = await AuditEvent.findOne({ correlationId: event.correlationId });
  if (exists) continue;
  await recordAudit({ actor: admin, ...event });
}

const counts = [
  ["users", User],
  ["employees", Employee],
  ["clients", Client],
  ["departments", Department],
  ["leaves", Leave],
  ["workrequests", WorkRequest],
  ["salaries", Salary],
  ["projects", Project],
  ["tasks", Task],
  ["materials", Material],
  ["stockmoves", StockMovement],
  ["vendors", Vendor],
  ["expenses", Expense],
  ["invoices", Invoice],
  ["equipment", Equipment],
  ["safety", SafetyIncident],
  ["documents", DocumentFile],
  ["notifications", Notification],
  ["reports", DailyReport],
  ["auditevents", AuditEvent],
];
for (const [label, model] of counts) {
  console.log(`  ${label.padEnd(13)} ${await model.countDocuments()}`);
}

await mongoose.disconnect();
