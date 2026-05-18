import { Router } from "express";
import { createForm,getForms } from "../controllers/form.controller.js";
import { authMiddleware, optionalAuthMiddleware } from "../middleware/auth.middleware.js";
const router = Router();

router.route("/").post(authMiddleware, createForm)
router.route("/:slug").get(optionalAuthMiddleware, getForms);

export default router;