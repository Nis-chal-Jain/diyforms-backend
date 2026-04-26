import mongoose from "mongoose";

const questionAnalyticsSchema = new mongoose.Schema({

    questionId:{
        type: mongoose.Schema.Types.ObjectId,
        required:true
    },

    type:{
        type:String,
        enum:["text","textarea","number","radio","checkbox"],
        required:true
    },

    // Numerical analytics
    numberStats:{
        min:Number,
        max:Number,
        mean:Number,
        median:Number,
        mode:Number,
        count:Number
    },

    // Radio (single select)
    optionStats:[{
        option:String,
        count:Number
    }],

    // Checkbox (multi select)
    checkboxStats:[{
        option:String,
        count:Number
    }],

},{ _id:false });

const analyticsSchema = new mongoose.Schema({

    form:{
        type: mongoose.Schema.Types.ObjectId,
        ref:"Form",
        required:true,
        unique:true // one analytics doc per form
    },

    totalResponses:{
        type:Number,
        default:0
    },

    questionsAnalytics:[questionAnalyticsSchema],

    lastUpdated:{
        type:Date,
        default:Date.now
    }

},{ timestamps:true });

export const Analytics = mongoose.model("Analytics", analyticsSchema);