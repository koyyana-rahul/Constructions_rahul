import Attendance from "../models/Attendance.js";
import Employee from "../models/Employee.js";

/** Business date in `YYYY-MM-DD`, computed in the server's local timezone. */
export const businessDate = (d = new Date()) => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

/**
 * Ensures every active employee has a row for the given business date.
 *
 * - R9 fix: the field is `status` (was the `staus` typo).
 * - R10 fix: idempotent via a bulk upsert, so repeated/concurrent page loads
 *   cannot create duplicates even before the unique index is built.
 * - A created row is `null` (unmarked), never "Present".
 */
const defaultAttendance = async (req, res, next) => {
  const date = businessDate();

  try {
    const employees = await Employee.find({}, "_id");

    if (employees.length) {
      const ops = employees.map((employee) => ({
        updateOne: {
          filter: { employeeId: employee._id, date },
          update: {
            $setOnInsert: {
              employeeId: employee._id,
              date,
              status: null,
            },
          },
          upsert: true,
        },
      }));

      // Ordered bulk write; duplicate-key (11000) is treated as success because
      // a concurrent request already created the row.
      const result = await Attendance.bulkWrite(ops, { ordered: false });
      if (result?.errors?.length) {
        const onlyDuplicates = result.errors.every(
          (e) => e.code === 11000 || e.err?.code === 11000
        );
        if (!onlyDuplicates) {
          console.error("[defaultAttendance] write errors:", result.errors);
        }
      }
    }

    return next();
  } catch (error) {
    console.error("[defaultAttendance]", error.message);
    return res.status(500).json({
      success: false,
      error: "Could not prepare attendance for today",
      code: "ATTENDANCE_INIT_FAILED",
    });
  }
};

export default defaultAttendance;