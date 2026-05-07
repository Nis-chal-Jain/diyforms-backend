import express from 'express';
import cookiesParser from 'cookie-parser';
const app = express();

app.use(express.json());
app.use(cookiesParser());
app.use(express.urlencoded({extended: true, limit: "16kb"}))

import userRoutes from './routes/user.routes.js';
app.use("/api/v1/users",userRoutes)

export {app}