import mongoose from 'mongoose';

const DBconnect = async () => {
    console.log("Connecting to DB...");
    try{
        const con = await mongoose.connect(process.env.db_url+"/"+process.env.db_name)
        console.log("DB Connected "+con.connection.host);
    }catch(err){
        console.error("DB Connection Error:", err);
    }
}

export default DBconnect;