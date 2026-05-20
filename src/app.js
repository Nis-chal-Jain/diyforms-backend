import express from 'express';
import cookiesParser from 'cookie-parser';
import cors from 'cors';
import { errorHandler } from './middleware/error.middleware.js';
const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
}));
app.use(express.json());
app.use(cookiesParser());
app.use(express.urlencoded({extended: true, limit: "16kb"}))

import userRoutes from './routes/user.routes.js';
app.use("/api/v1/users",userRoutes)

import formRoutes from './routes/form.routes.js';
app.use("/api/v1/forms",formRoutes)

import responseRoutes from './routes/response.routes.js';
app.use("/api/v1/responses",responseRoutes)

import analyticsRoutes from './routes/analytics.routes.js';
app.use("/api/v1/analytics", analyticsRoutes);

app.use(errorHandler);

export {app}