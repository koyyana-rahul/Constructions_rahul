import mongoose from "mongoose";
import { Schema } from "mongoose";

const employeeSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  employeeId: { type: String, required: true, unique: true },
  dob: { type: Date },
  gender: { type: String },
  maritalStatus: { type: String },
  designation: { type: String },
  department: { type: Schema.Types.ObjectId, ref:"Department", required: true },
  salary: { type: Number, required: true },
  // Deactivated when their site is archived, so they cannot be assigned work.
  isActive: { type: Boolean, default: true, index: true },
  // Remembers which archive deactivated this employee. Restore only revives
  // employees that the matching site archive actually deactivated.
  deactivatedBySite: { type: Schema.Types.ObjectId, ref: "Department", index: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Employee = mongoose.model("Employee", employeeSchema);
export default Employee;
