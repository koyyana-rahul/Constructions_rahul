import mongoose from "mongoose";

/**
 * Project and site documents (drawings, contracts, permits, reports).
 *
 * Files live OUTSIDE the public upload directory and are streamed by an
 * authorised route, because a drawing or a contract is not public content.
 * `isClientVisible` controls whether the client portal can see the file.
 */
const documentSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", index: true },
    site: { type: mongoose.Schema.Types.ObjectId, ref: "Department", index: true },

    category: {
      type: String,
      enum: [
        "Drawing",
        "Contract",
        "Permit",
        "Report",
        "Specification",
        "Certificate",
        "Photo",
        "Other",
      ],
      default: "Other",
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    filename: { type: String, required: true },
    originalName: { type: String, trim: true },
    mimetype: { type: String, trim: true },
    size: { type: Number, default: 0 },
    version: { type: Number, default: 1 },
    notes: { type: String, trim: true, maxlength: 2000 },
    isClientVisible: { type: Boolean, default: true, index: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

documentSchema.index({ project: 1, category: 1, createdAt: -1 });

const DocumentFile = mongoose.model("DocumentFile", documentSchema);
export default DocumentFile;
