import mongoose from "mongoose";

const answerSchema = new mongoose.Schema({
    questionId:{
        type:mongoose.Schema.Types.ObjectId,
        required:true
    },
    value:{
        type:mongoose.Schema.Types.Mixed,
        required:true
    }
},{ _id:false });

const responseSchema = new mongoose.Schema({

    form:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Form",
        required:true,
        index:true
    },

    email:{
        type:String,
        required:false,
        default:null,
    },

    answers:[answerSchema]
    
},{ timestamps:true });

export const Response = mongoose.model("Response", responseSchema);