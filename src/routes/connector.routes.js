import { Router } from "express";
import {
    createConnectorToken,
    listConnectorTokens,
    revokeConnectorToken,
} from "../controllers/connectorToken.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = Router();

router.route("/").post(authMiddleware, createConnectorToken);
router.route("/").get(authMiddleware, listConnectorTokens);
router.route("/:id").delete(authMiddleware, revokeConnectorToken);

export default router;
