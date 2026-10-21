import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import Client from "../models/Client.js";
import {
  addClient,
  getClients,
  getClient,
  updateClient,
  deleteClient,
} from "../controllers/clientController.js";
import authenticate from "../middleware/authMiddlware.js";
import { requireAdmin, requireRole, requireSelfOrAdmin } from "../middleware/authorize.js";
import { uploadImage } from "../middleware/multerConfig.js";

/**
 * Resolves the `User._id` owning a `Client` record, for the ownership check.
 *
 * The `:id` in the URL is NOT always a `Client._id`:
 *   - the admin route addresses a client by `Client._id`;
 *   - the self-service route (`/client-dashboard/profile/:id`) addresses them
 *     by `User._id`.
 *
 * `getClient` already accepts either, so this resolver MUST accept either too.
 * When it did not, a client opening their OWN profile was rejected with 403.
 */
const resolveClientUserId = async (req) => {
  const { id } = req.params;

  let client = await Client.findById(id).select("userId");
  if (!client) {
    client = await Client.findOne({ userId: id }).select("userId");
  }

  return client?.userId ?? null;
};

const router = express.Router();

/**
 * R1 fix: every route now requires authentication, and client-record
 * mutation is admin-only. Previously all five routes were fully open -
 * `POST /api/client/add` and `GET /api/client` succeeded with no token.
 *
 * Read scope: admin sees every client; a client sees only their own record.
 * Employees have no client-administration need, so they are excluded.
 */

router.get("/", authenticate, requireRole("admin", "client"), asyncHandler(getClients));

// Public signup already exists at POST /api/auth/register.
router.post("/add", authenticate, requireAdmin, uploadImage.single("image"), asyncHandler(addClient));

router.get(
  "/:id",
  authenticate,
  requireRole("admin", "client"),
  requireSelfOrAdmin(resolveClientUserId),
  asyncHandler(getClient)
);

router.put("/:id", authenticate, requireAdmin, asyncHandler(updateClient));
router.delete("/:id", authenticate, requireAdmin, asyncHandler(deleteClient));

export default router;