import mongoose from "mongoose";
import StockMovement from "../models/StockMovement.js";
import Material from "../models/Material.js";
import ApiError from "../utils/ApiError.js";

/**
 * Stock is derived from the movement ledger.
 *
 * `In` adds, `Out` subtracts, `Adjustment` carries a signed quantity. Nothing
 * mutates a stored counter, so the ledger and the reported balance can never
 * disagree.
 */

const signedQuantity = (movement) => {
  const qty = Number(movement.quantity) || 0;
  if (movement.type === "In") return Math.abs(qty);
  if (movement.type === "Out") return -Math.abs(qty);
  return qty; // adjustment is signed on purpose
};

/** On-hand balance for one material at one site. */
export const stockFor = async (materialId, siteId, { session } = {}) => {
  const rows = await StockMovement.aggregate([
    {
      $match: {
        material: new mongoose.Types.ObjectId(materialId),
        site: new mongoose.Types.ObjectId(siteId),
      },
    },
    {
      $group: {
        _id: null,
        balance: {
          $sum: {
            $switch: {
              branches: [
                { case: { $eq: ["$type", "In"] }, then: { $abs: "$quantity" } },
                { case: { $eq: ["$type", "Out"] }, then: { $multiply: [{ $abs: "$quantity" }, -1] } },
              ],
              default: "$quantity",
            },
          },
        },
        movements: { $sum: 1 },
      },
    },
  ]).session(session || null);

  return { balance: rows[0]?.balance || 0, movements: rows[0]?.movements || 0 };
};

/** Balances for many materials at one site, as a plain map. */
export const stockMapForSite = async (siteId, materialIds = null) => {
  const match = { site: new mongoose.Types.ObjectId(siteId) };
  if (Array.isArray(materialIds) && materialIds.length) {
    match.material = { $in: materialIds.map((id) => new mongoose.Types.ObjectId(id)) };
  }

  const rows = await StockMovement.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$material",
        balance: {
          $sum: {
            $switch: {
              branches: [
                { case: { $eq: ["$type", "In"] }, then: { $abs: "$quantity" } },
                { case: { $eq: ["$type", "Out"] }, then: { $multiply: [{ $abs: "$quantity" }, -1] } },
              ],
              default: "$quantity",
            },
          },
        },
        value: { $sum: { $multiply: [{ $ifNull: ["$quantity", 0] }, { $ifNull: ["$unitCost", 0] }] } },
        lastMovementAt: { $max: "$date" },
      },
    },
  ]);

  return rows.reduce((acc, row) => {
    acc[String(row._id)] = row;
    return acc;
  }, {});
};

/**
 * Records a movement after validating the resulting balance.
 *
 * An OUT movement that would drive stock below zero is refused with a 409,
 * because negative stock usually means a typo or a missing goods-received
 * entry. Corrections use a signed Adjustment with a mandatory note.
 */
export const recordMovement = async (
  { material, site, type, quantity, unitCost, reference, note, date, source, sourceId, createdBy },
  { session, allowNegative = false } = {}
) => {
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty === 0) {
    throw ApiError.badRequest("Quantity must be a non-zero number", {
      code: "INVALID_QUANTITY",
    });
  }
  if (type === "Out" && qty < 0) {
    throw ApiError.badRequest("An Out movement needs a positive quantity", {
      code: "INVALID_QUANTITY",
    });
  }
  if (type === "Adjustment" && !String(note || "").trim()) {
    throw ApiError.badRequest("An adjustment requires a reason", {
      code: "REASON_REQUIRED",
    });
  }

  const current = await stockFor(material, site, { session });
  const next = current.balance + signedQuantity({ type, quantity: qty });

  if (next < 0 && !allowNegative) {
    const materialDoc = await Material.findById(material).select("name unit");
    throw new ApiError(
      409,
      `Insufficient stock for ${materialDoc?.name || "material"}: ` +
        `${current.balance} ${materialDoc?.unit || "units"} available, ${Math.abs(qty)} required.`,
      {
        code: "INSUFFICIENT_STOCK",
        details: { available: current.balance, requested: Math.abs(qty) },
      }
    );
  }

  const [movement] = await StockMovement.create(
    [
      {
        material,
        site,
        type,
        quantity: qty,
        unitCost: Number(unitCost) || 0,
        reference: reference || undefined,
        note: note || undefined,
        date: date || new Date(),
        source: source || "Manual",
        sourceId: sourceId || undefined,
        createdBy,
      },
    ],
    session ? { session } : {}
  );

  return { movement, balanceAfter: next };
};

export const defaultInventorySummary = () => ({
  totalMaterials: 0,
  lowStockCount: 0,
  outOfStockCount: 0,
  stockValue: 0,
});

export default { stockFor, stockMapForSite, recordMovement };
