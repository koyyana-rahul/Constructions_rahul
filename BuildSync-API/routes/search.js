import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import authenticate from "../middleware/authMiddlware.js";
import { globalSearch, searchSuggestions } from "../controllers/searchController.js";

const router = express.Router();

/** Global search is role-scoped inside the controller (projects, tasks, etc.). */
router.get("/", authenticate, asyncHandler(globalSearch));
router.get("/suggestions", authenticate, asyncHandler(searchSuggestions));

export default router;
