import Organization from "../models/Organization.js";

/**
 * Company profile + atomic document numbering.
 *
 * Counters live on the singleton Organization document and are incremented
 * with `$inc`, which Mongo applies atomically. Two administrators creating an
 * invoice at the same moment therefore receive different numbers.
 */

export const getOrganization = async () => {
  let org = await Organization.findOne({ key: "default" });
  if (!org) {
    try {
      org = await Organization.create({ key: "default" });
    } catch (error) {
      // A concurrent request created it first.
      if (error?.code !== 11000) throw error;
      org = await Organization.findOne({ key: "default" });
    }
  }
  return org;
};

const nextSequence = async (field) => {
  await getOrganization();
  const org = await Organization.findOneAndUpdate(
    { key: "default" },
    { $inc: { [field]: 1 } },
    { new: true }
  );
  return { org, sequence: org[field] };
};

const year = () => new Date().getFullYear();

const formatted = (prefix, sequence) =>
  `${prefix || "DOC"}-${year()}-${String(sequence).padStart(4, "0")}`;

export const nextInvoiceNumber = async () => {
  const { org, sequence } = await nextSequence("invoiceSequence");
  return formatted(org.invoicePrefix, sequence);
};

export const nextProjectCode = async () => {
  const { org, sequence } = await nextSequence("projectSequence");
  return formatted(org.projectPrefix, sequence);
};

export const nextMaterialSku = async () => {
  const { org, sequence } = await nextSequence("materialSequence");
  return `MAT-${String(sequence).padStart(5, "0")}`;
};

export default { getOrganization, nextInvoiceNumber, nextProjectCode, nextMaterialSku };
