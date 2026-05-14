import { Router } from "express";
import { createForm } from "../controllers/form.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
const router = Router();

router.route("/").post(authMiddleware, createForm)

export default router;