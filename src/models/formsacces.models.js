import mongoose from "mongoose";

const formsAccesSchema = new mongoose.Schema({
    form:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Form",
        required:true
    },
    user:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
})

formsAccesSchema.index({form:1,user:1})

export const FormsAccess = mongoose.model("FormsAccess", formsaccesSchema);