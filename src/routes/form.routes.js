import { Router } from "express";
import { createForm, listMyForms, getForms, updateForm, deleteForm } from "../controllers/form.controller.js";
import { authMiddleware, optionalAuthMiddleware } from "../middleware/auth.middleware.js";
const router = Router();

router.route("/").get(authMiddleware, listMyForms)
router.route("/").post(authMiddleware, createForm)
router.route("/:slug").get(optionalAuthMiddleware, getForms);
router.route("/:slug").post(authMiddleware, updateForm);
router.route("/:slug").delete(authMiddleware, deleteForm);

export default router;