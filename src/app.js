import express from 'express';
import cookiesParser from 'cookie-parser';

const app = express();

app.use(express.json());
app.use(cookiesParser());

export {app}