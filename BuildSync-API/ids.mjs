import mongoose from "mongoose";
await mongoose.connect(process.env.MONGODB_URL);
for (const m of [
  "./models/User.js",
  "./models/Employee.js",
  "./models/Department.js",
  "./models/Leave.js",
  "./models/Salary.js",
  "./models/Attendance.js",
])
  await import(m);
const Employee = (await import("./models/Employee.js")).default;
for (const e of await Employee.find().select("employeeId userId department"))
  console.log(e.employeeId, "->", e._id.toString());
await mongoose.disconnect();
