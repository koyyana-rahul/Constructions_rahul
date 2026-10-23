import Attendance from "../models/Attendance.js";
import Employee from "../models/Employee.js";

/**
 * Business date in `YYYY-MM-DD`.
 *
 * Dates that users type into forms are calendar dates in the company's
 * timezone, not UTC instants. Computing them from the server's OS timezone
 * breaks in two common cases: a UTC server rejects an Indian user's "today"
 * as tomorrow, and an ISR runtime can report a different month than users see.
 * The company timezone is configurable and defaults to India (INR/GST product).
 */
export const BUSINESS_TIMEZONE = process.env.BUSINESS_TIMEZONE || "Asia/Kolkata";

const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const businessDate = (d = new Date()) => {
  const parts = formatter.formatToParts(d);
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
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
    const employees = await Employee.find({ isActive: { $ne: false } }, "_id").lean();

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