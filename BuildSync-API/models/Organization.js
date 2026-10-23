import mongoose from "mongoose";

/**
 * Company profile and numbering settings. A singleton document keyed
 * "default". Used by invoices, exports and the print views.
 */
const organizationSchema = new mongoose.Schema(
  {
    key: { type: String, default: "default", unique: true },
    name: { type: String, default: "Your Construction Company", trim: true },
    legalName: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    website: { type: String, trim: true },
    address: { type: String, trim: true, maxlength: 1000 },
    gstin: { type: String, trim: true, uppercase: true },
    logo: { type: String },

    currency: { type: String, default: "INR", uppercase: true },
    taxRate: { type: Number, default: 18, min: 0, max: 100 },
    invoicePrefix: { type: String, default: "INV", uppercase: true, trim: true },
    projectPrefix: { type: String, default: "PRJ", uppercase: true, trim: true },
    invoiceTerms: {
      type: String,
      default: "Payment due within 30 days of the invoice date.",
      trim: true,
      maxlength: 2000,
    },

    // Atomic counters for human-readable document numbers.
    invoiceSequence: { type: Number, default: 0, min: 0 },
    projectSequence: { type: Number, default: 0, min: 0 },
    materialSequence: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

const Organization = mongoose.model("Organization", organizationSchema);
export default Organization;
