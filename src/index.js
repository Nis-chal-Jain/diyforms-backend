import dotenv from 'dotenv';
dotenv.config();
import connectDB from './db/index.js';
import {app} from './app.js';

const PORT = process.env.PORT || 8000;

connectDB()
.then(()=>{
    console.log("connected to DB successfully. Starting server...");
    app.listen(PORT,()=>{
        console.log(`Server running on port ${PORT}`);
    });
})
.catch(()=>{
    console.error("Failed to connect to DB. Exiting...");
});

