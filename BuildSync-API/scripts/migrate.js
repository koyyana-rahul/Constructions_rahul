/**
 * BuildSync data migration.
 *
 * Idempotent and non-destructive by default: every step is safe to re-run and
 * only reports what it would do under `--dry-run`.
 *
 *   node --env-file=.env scripts/migrate.js --dry-run
 *   node --env-file=.env scripts/migrate.js
 *
 * Steps
 *  1. Normalise attendance status to TitleCase      (fixes R8)
 *  2. Detect + report duplicate attendance rows     (blocks the unique index)
 *  3. Backfill the new isArchived / isDisabled / isActive defaults
 *  4. Build the Attendance {employeeId, date} unique index
 *  5. Normalise user emails to lowercase
 *  6. Report orphaned Attendance rows left by the old destructive cascade (R4)
 */
import mongoose from "mongoose";

import Attendance from "../models/Attendance.js";
import Department from "../models/Department.js";
import Employee from "../models/Employee.js";
import User from "../models/User.js";

const DRY_RUN = process.argv.includes("--dry-run");

const CANONICAL = ["Present", "Absent", "Sick", "Leave"];

async function step1NormaliseAttendanceStatus() {
  const report = [];
  for (const raw of ["present", "absent", "sick", "leave"]) {
    const filter = { status: raw };
    const count = await Attendance.countDocuments(filter);
    if (count) {
      report.push({ from: raw, to: CANONICAL.find((c) => c.toLowerCase() === raw), count });
    }
  }

  // Anything that is neither a canonical value nor unset/null is invalid.
  // (Must not repeat the `status` key in one filter - the later key wins.)
  const invalid = await Attendance.countDocuments({
    status: { $nin: [...CANONICAL, null] },
  });

  if (!DRY_RUN) {
    for (const row of report) {
      await Attendance.updateMany({ status: row.from }, { $set: { status: row.to } });
    }
  }

  console.log("1. Attendance status normalisation");
  if (report.length === 0) console.log("   nothing to normalise");
  for (const row of report) console.log(`   ${row.from} -> ${row.to}  (${row.count} rows)`);
  if (invalid) console.log(`   WARNING: ${invalid} rows hold an unrecognised status`);
}

async function step2DetectDuplicateAttendance() {
  const duplicates = await Attendance.aggregate([
    { $group: { _id: { employeeId: "$employeeId", date: "$date" }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]);

  console.log("\n2. Duplicate attendance rows");
  if (duplicates.length === 0) {
    console.log("   none - the unique index can be created safely");
    return duplicates.length === 0;
  }

  console.log(`   ${duplicates.length} duplicated {employeeId,date} group(s) found.`);
  console.log("   The unique index CANNOT be built until these are resolved.");
  console.log("   Suggested resolution (inspect before running):");
  for (const dup of duplicates.slice(0, 10)) {
    const rows = await Attendance.find({ employeeId: dup._id.employeeId, date: dup._id.date })
      .sort({ createdAt: 1 })
      .lean();
    const marked = rows.filter((r) => r.status);
    console.log(
      `     employee=${dup._id.employeeId} date=${dup._id.date} copies=${dup.count} marked=${marked.length}`
    );
  }
  console.log("   Nothing was changed. Fix by hand, then re-run this script.");
  return false;
}

async function step3BackfillFlags() {
  const depCount = await Department.countDocuments({ isArchived: { $exists: false } });
  const userCount = await User.countDocuments({ isDisabled: { $exists: false } });
  const empCount = await Employee.countDocuments({ isActive: { $exists: false } });

  if (!DRY_RUN) {
    await Department.updateMany({ isArchived: { $exists: false } }, { $set: { isArchived: false } });
    await User.updateMany({ isDisabled: { $exists: false } }, { $set: { isDisabled: false } });
    await Employee.updateMany({ isActive: { $exists: false } }, { $set: { isActive: true } });
  }

  console.log("\n3. Flag backfill");
  console.log(`   Department.isArchived  -> false  (${depCount})`);
  console.log(`   User.isDisabled        -> false  (${userCount})`);
  console.log(`   Employee.isActive      -> true   (${empCount})`);
}

async function step4BuildAttendanceIndex() {
  const safe = await step2DetectDuplicateAttendance();
  console.log("\n4. Attendance unique index { employeeId, date }");
  if (!safe) {
    console.log("   SKIPPED - resolve the duplicates listed above first.");
    return;
  }

  if (DRY_RUN) {
    console.log("   DRY RUN - index not created");
    return;
  }

  try {
    await Attendance.createIndexes();
    console.log("   ensured (safe to re-run)");
  } catch (error) {
    console.log(`   FAILED: ${error.message}`);
  }
}

async function step5NormaliseEmails() {
  const users = await User.find({}, "email").lean();
  const offenders = users.filter((u) => u.email !== String(u.email).trim().toLowerCase());

  if (!DRY_RUN) {
    for (const u of offenders) {
      await User.updateOne({ _id: u._id }, { $set: { email: String(u.email).trim().toLowerCase() } });
    }
  }

  console.log("\n5. User email normalisation");
  console.log(`   ${offenders.length} email(s) lowercased/trimmed`);
}

async function step6ReportOrphans() {
  const employees = await Employee.find({}, "_id").lean();
  const employeeIds = new Set(employees.map((e) => String(e._id)));

  const orphanAttendance = await Attendance.find({ employeeId: { $nin: [...employeeIds] } })
    .limit(1000)
    .lean();

  const orphanLeaves = await (await import("../models/Leave.js")).default.find({
    employeeId: { $nin: [...employeeIds] },
  }).limit(1000).lean();

  console.log("\n6. Orphaned historical records (R4)");
  console.log(
    `   Attendance rows referencing a deleted employee: ${orphanAttendance.length}`
  );
  console.log(`   Leave rows referencing a deleted employee:     ${orphanLeaves.length}`);
  if (orphanAttendance.length) {
    console.log("   These were orphaned by the previous destructive site-delete cascade.");
    console.log("   They are left in place - removing payroll/attendance history is a");
    console.log("   retention decision for the business, not a migration.");
    console.log("   Sample employee ids:");
    for (const row of orphanAttendance.slice(0, 5)) {
      console.log(`     ${row.employeeId}  ${row.date}`);
    }
  }
}

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URL);
  console.log(DRY_RUN ? "\n=== DRY RUN - no data will be written ===\n" : "\n=== MIGRATION ===\n");

  await step1NormaliseAttendanceStatus();
  await step3BackfillFlags();
  await step4BuildAttendanceIndex();
  await step5NormaliseEmails();
  await step6ReportOrphans();

  console.log("\nDone.\n");
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});