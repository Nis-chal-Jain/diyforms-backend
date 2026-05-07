import { User } from "../models/users.models.js"
import { ApiError } from "../utils/ApiError.js";
import {ApiResponse} from "../utils/ApiResponse.js";
import {asyncHandler} from "../utils/asyncHandler.js";
const signUp =  asyncHandler(async (req,res) =>{
        const {username,email,password,name} = req.body;

        //validation 
        if(!username || !email || !password || !name){
            throw new ApiError(400,"All fields are required")
        }

        // Check if user already exists
        const existingUser = await User.findOne({
            $or: [{email}, {username}]
        });

        if(existingUser){
            throw new ApiError(400,"User already exists with the provided email or username")
        }

        // Create new user
        const newUser = await User.create({
            username,
            email,
            password,
            name
        })

        const createdUser = await User.findById(newUser._id).select("-password -refreshToken")
        
        if(!createdUser){
            throw new ApiError(500,"User creation failed")
        }

        return res.status(201).json(new ApiResponse(201,"User created successfully",createdUser)) 
}
)

export {signUp}