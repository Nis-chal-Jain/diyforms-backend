import mongoose from "mongoose";

const questionSchema = new mongoose.Schema({
    type:{
        type:String,
        enum:["text","textarea","number","radio","checkbox"],
        required:true
    },
    label:{
        type:String,
        required:true
    },
    required:{
        type:Boolean,
        default:false
    },

    //only when the type is radio or checkbox
    options:[{
        value:{
            type:String,
            required:true
        }
    }],
    validation:{
        min:Number,
        max:Number,
        minLength:Number,
        maxLength:Number
    }
},{ _id:true });

const formSchema = new mongoose.Schema({

    formSlug:{
        type:String,
        required:true,
        unique:true,
        index:true
    },

    active:{
        type:Boolean,
        default:true
    },

    title:{
        type:String,
        required:true,
        trim:true
    },

    description:{
        type:String,
        default:""
    },

    author:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
    },

    restricted:{
        type:Boolean,
        default:false
    },

    allowedUsers:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User"
    }],

    questions:[questionSchema],

    analyticsUpToDate:{
        type:Boolean,
        default:false
    }

},{ timestamps:true });

export const Form = mongoose.model("Form", formSchema);