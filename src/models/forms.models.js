import mongoose from "mongoose";

const questionSchema = new mongoose.Schema({
    order:{
        type:Number,
        required:true
    },
    type:{
        type:String,
        enum:["text","textarea","number","radio","checkbox","select"],
        required:true
    },
    label:{
        type:String,
        required:true
    },
    description:String,
    placeholder:String,

    required:{
        type:Boolean,
        default:false
    },

    //only when the type is radio or checkbox or select
    options:[{
        value:{
            type:String,
            required:true
        }
    }],

    //only when the type is number or text or textarea
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

    settings:{
        status:{
            type:String,
            enum:["draft","published","archived"]
        },

        restricted:{
            type:Boolean,
            default:false
        }
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

    questions:[questionSchema],

    analyticsUpToDate:{
        type:Boolean,
        default:false
    }

},{ timestamps:true });

formSchema.index({author:1})

export const Form = mongoose.model("Form", formSchema);