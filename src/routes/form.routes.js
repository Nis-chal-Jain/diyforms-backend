import { Router } from "express";
import { createForm, listMyForms, getForms, updateForm, deleteForm, stopResponse, resumeResponse } from "../controllers/form.controller.js";
import { authMiddleware, authOrConnector, optionalAuthOrConnector } from "../middleware/auth.middleware.js";
const router = Router();

router.route("/").get(authOrConnector, listMyForms)
router.route("/").post(authOrConnector, createForm)
router.route("/:slug").get(optionalAuthOrConnector, getForms);
router.route("/:slug").post(authOrConnector, updateForm);
// JWT only: a connector token must never publish, archive, resume, or delete a form.
router.route("/:slug").delete(authMiddleware, deleteForm);
router.route("/:slug/stop-response").patch(authMiddleware, stopResponse);
router.route("/:slug/resume-response").patch(authMiddleware, resumeResponse);
export default router;
