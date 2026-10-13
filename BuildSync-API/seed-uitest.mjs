import mongoose from "mongoose";
import bcrypt from "bcrypt";

await mongoose.connect(process.env.MONGODB_URL);

const User = (await import("./models/User.js")).default;
const Employee = (await import("./models/Employee.js")).default;
const Client = (await import("./models/Client.js")).default;
const Department = (await import("./models/Department.js")).default;
const Leave = (await import("./models/Leave.js")).default;
const WorkRequest = (await import("./models/Work.js")).default;
const Salary = (await import("./models/Salary.js")).default;

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
  ["Casual Leave", 2, 3, "Pending"],
  ["Annual Leave", 5, 9, "Pending"],
  ["Sick Leave", -6, -5, "Approved"],
  ["Casual Leave", -12, -12, "Approved"],
  ["Annual Leave", -20, -24, "Rejected"],
];
for (const [leaveType, from, to, status] of leaves) {
  const exists = await Leave.findOne({ reason: `${leaveType}|${from}` });
  if (exists) continue;
  await Leave.create({
    employeeId: (await Employee.findOne({ employeeId: "UI-1001" }))._id,
    leaveType,
    startDate: day(from),
    endDate: day(to),
    reason: `${leaveType}|${from}`,
    status,
    appliedAt: day(from - 3),
  });
}

const works = [
  ["Tower crane installation", "Equipment", "Pending"],
  ["Podium slab pour", "Civil", "Pending"],
  ["Steel shuttering supply", "Materials", "Under Review"],
  ["Site hoarding repair", "Civil", "Approved"],
  ["MEP duct routing", "MEP", "In Progress"],
];
for (const [name, requestType, status] of works) {
  const exists = await WorkRequest.findOne({ name });
  if (exists) continue;
  await WorkRequest.create({
    clientId: (await Client.findOne({ userId: cliUser._id }))._id,
    name,
    requestType,
    entityType: "legal",
    startDate: day(3),
    endDate: day(10),
    details: `${name} - seeded for verification`,
    status,
    appliedAt: day(-1),
  });
}

const salarySeeds = [
  ["UI-1001", 52000, 62000, day(-30)],
  ["UI-1002", 45000, 54000, day(-30)],
];
for (const [employeeId, basic, net, payDate] of salarySeeds) {
  const emp = await Employee.findOne({ employeeId });
  const exists = await Salary.findOne({ employeeId: emp._id, payDate });
  if (exists) continue;
  await Salary.create({ employeeId: emp._id, basicSalary: basic, allowances: 8000, deductions: 2000, netSalary: net, payDate });
}

for (const [label, model] of [["users", User], ["employees", Employee], ["clients", Client], ["departments", Department], ["leaves", Leave], ["workrequests", WorkRequest], ["salaries", Salary]]) {
  console.log(`  ${label.padEnd(12)} ${await model.countDocuments()}`);
}

await mongoose.disconnect();