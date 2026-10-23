import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import authenticate from "../middleware/authMiddlware.js";
import { uploadDocumentFile } from "../middleware/multerConfig.js";
import {
  listDocuments,
  getDocument,
  uploadDocument,
  updateDocument,
  downloadDocument,
  deleteDocument,
} from "../controllers/documentController.js";

const router = express.Router();

/**
 * The document vault. Metadata and file contents are never public: every
 * request is authenticated and the controller checks project/site/client
 * visibility before streaming a file from the private directory.
 */
router.get("/", authenticate, asyncHandler(listDocuments));
router.post(
  "/",
  authenticate,
  uploadDocumentFile.single("file"),
  asyncHandler(uploadDocument)
);

router.get("/:id", authenticate, asyncHandler(getDocument));
router.put("/:id", authenticate, asyncHandler(updateDocument));
router.get("/:id/download", authenticate, asyncHandler(downloadDocument));
router.delete("/:id", authenticate, asyncHandler(deleteDocument));

export default router;
