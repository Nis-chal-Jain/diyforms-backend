import { Router } from "express";
import { getFormAnalytics } from "../controllers/analytics.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
const router = Router();

router.route("/:slug").get(authMiddleware, getFormAnalytics);

export default router;