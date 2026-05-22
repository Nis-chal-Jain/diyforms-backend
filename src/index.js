import "./env.config.js";
import connectDB from './db/index.js';
import {app} from './app.js';
import "./db/redis.js";

const PORT = process.env.port || 8080;

connectDB()
.then(()=>{
    console.log("connected to DB successfully. Starting server...");
    app.listen(PORT,"0.0.0.0",()=>{
        console.log(`Server running on port ${PORT}`);
    });
})
.catch(()=>{
    console.error("Failed to connect to DB. Exiting...");
});

