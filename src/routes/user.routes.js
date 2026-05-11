import { Router } from "express";
import {
    signUp,
    login,
    logout,
    refreshAccessToken,
    updatePassword
} from "../controllers/user.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = Router();

router.route("/signup").post(signUp)
router.route("/login").post(login)
router.route("/logout").post(authMiddleware, logout)
router.route("/refresh-token").post(refreshAccessToken)
router.route("/update-password").post(authMiddleware, updatePassword)

export default router;