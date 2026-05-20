import { Router } from "express";
const router = Router();
import { submitResponse,getFormForResponse } from "../controllers/response.controller.js";
import { optionalAuthMiddleware } from "../middleware/auth.middleware.js";

router.route("/:slug").post(optionalAuthMiddleware, submitResponse);
router.route("/:slug").get(optionalAuthMiddleware, getFormForResponse);

export default router;