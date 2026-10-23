import ApiError from "../utils/ApiError.js";
import { getOrganization } from "../services/numberingService.js";
import { recordAudit } from "../services/auditService.js";

const PUBLIC_FIELDS =
  "name legalName email phone website address gstin logo currency taxRate invoicePrefix projectPrefix invoiceTerms createdAt updatedAt";

export const getOrganizationProfile = async (_req, res) => {
  const organization = await getOrganization();
  return res.status(200).json({
    success: true,
    organization: organization.toObject
      ? organization.toObject({
          transform: (_doc, ret) => {
            delete ret.key;
            delete ret.invoiceSequence;
            delete ret.projectSequence;
            delete ret.materialSequence;
            delete ret.__v;
            return ret;
          },
        })
      : organization,
  });
};

export const updateOrganization = async (req, res) => {
  const organization = await getOrganization();
  const before = organization.toObject();

  const stringFields = [
    ["name", 200],
    ["legalName", 200],
    ["email", 200],
    ["phone", 50],
    ["website", 300],
    ["address", 1000],
    ["gstin", 30],
    ["logo", 500],
    ["invoiceTerms", 2000],
  ];
  for (const [field, max] of stringFields) {
    if (req.body[field] !== undefined) {
      organization[field] = String(req.body[field] || "").trim().slice(0, max);
    }
  }

  if (req.body.currency !== undefined) {
    const currency = String(req.body.currency).trim().toUpperCase().slice(0, 3);
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw ApiError.badRequest("Currency must be a three-letter ISO code", { code: "INVALID_CURRENCY" });
    }
    organization.currency = currency;
  }
  if (req.body.taxRate !== undefined) {
    const rate = Number(req.body.taxRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      throw ApiError.badRequest("Tax rate must be between 0 and 100", { code: "INVALID_TAX_RATE" });
    }
    organization.taxRate = rate;
  }
  for (const field of ["invoicePrefix", "projectPrefix"]) {
    if (req.body[field] !== undefined) {
      const value = String(req.body[field]).trim().toUpperCase().slice(0, 10);
      if (!/^[A-Z0-9]{1,10}$/.test(value)) {
        throw ApiError.badRequest(
          `${field === "invoicePrefix" ? "Invoice" : "Project"} prefix must contain only letters and digits`,
          { code: "INVALID_PREFIX" }
        );
      }
      organization[field] = value;
    }
  }

  if (organization.name === "") organization.name = before.name || "Your Construction Company";

  await organization.save();

  await recordAudit({
    actor: req.user,
    entityType: "Organization",
    entityId: organization._id,
    action: "organization.updated",
    reason: Object.keys(req.body).filter((key) => String(before[key] ?? "") !== String(organization[key] ?? "")).join(", ") || "profile updated",
  });

  return res.status(200).json({
    success: true,
    organization: organization.toObject({
      transform: (_doc, ret) => {
        delete ret.key;
        delete ret.invoiceSequence;
        delete ret.projectSequence;
        delete ret.materialSequence;
        delete ret.__v;
        return ret;
      },
    }),
  });
};

/** Next numbers preview for the settings page. */
export const nextNumbers = async (_req, res) => {
  const organization = await getOrganization();
  const year = new Date().getFullYear();
  return res.status(200).json({
    success: true,
    next: {
      invoice: `${organization.invoicePrefix}-${year}-${String(organization.invoiceSequence + 1).padStart(4, "0")}`,
      project: `${organization.projectPrefix}-${year}-${String(organization.projectSequence + 1).padStart(4, "0")}`,
      material: `MAT-${String(organization.materialSequence + 1).padStart(5, "0")}`,
    },
  });
};

export default { getOrganizationProfile, updateOrganization, nextNumbers, PUBLIC_FIELDS };
