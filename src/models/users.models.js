import mongoose from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new mongoose.Schema({
    username:{
        type:String,
        required:true,
        unique:true,
        trim:true,
        minlength:3,
        maxlength:30
    },
    email:{
        type:String,
        required:true,
        unique:true,
        lowercase:true,
        trim:true,
        match: [/^\S+@\S+\.\S+$/, "Invalid email"]
    },
    password:{
        type:String,
        required:true,
        minlength:6,
        select:false
    },
    name:{
        type:String,
        required:true,
        trim:true
    },
    role:{
        type:String,
        enum:["user","admin"],
        default:"user"
    },

    subscription:{
        plan:{
            type:String,
            enum:["free","pro","enterprise"],
            default:"free"
        },
        validTill: Date,
        isActive:{
            type:Boolean,
            default:true
        }
    },

    usage:{
        formsCreated:{
            type:Number,
            default:0
        },
        responsesCollected:{
            type:Number,
            default:0
        }
    },

    formLimits:{
        monthlyCreated:{
            type:Number,
            default:0
        },
        lastReset:{
            type:Date,
            default:Date.now
        }
    },

    lastFormCreatedAt:{
        type:Date,
        default:null
    },

    avatar:{
        type:String
    },

    isDeleted:{
        type:Boolean,
        default:false
    }

},{timestamps:true});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });

// Password hashing
userSchema.pre("save", async function(next) {
    if (!this.isModified("password")) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

// Compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model("User", userSchema);