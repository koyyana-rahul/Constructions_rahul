import mongoose from "mongoose";
const { Schema } = mongoose;

const clientSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  entityType: { type: String, enum: ["natural", "legal"], required: true },
  companyName: { type: String, trim: true },
  phone: { type: String }, // Added phone field, optional
  image: { type: String }, // path to image in storage, optional
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Client = mongoose.model("Client", clientSchema);
export default Client;