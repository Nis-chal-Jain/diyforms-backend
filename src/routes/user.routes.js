import { Router } from "express";
import {
    signUp,
    login,
    logout
} from "../controllers/user.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = Router();

router.route("/signup").post(signUp)
router.route("/login").post(login)
router.route("/logout").post(authMiddleware, logout)

export default router;