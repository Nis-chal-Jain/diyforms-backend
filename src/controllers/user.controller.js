import { User } from "../models/users.models.js"
import { ApiError } from "../utils/ApiError.js";
import {ApiResponse} from "../utils/ApiResponse.js";
import {asyncHandler} from "../utils/asyncHandler.js";

const generateAccessAndRefereshTokens = async(userId) =>{
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
        
        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return {accessToken, refreshToken}


    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating referesh and access token")
    }
}

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

const login = asyncHandler(async (req,res) =>{
    const {email,username,password} = req.body;

    if((!email || !username) || !password){
        throw new ApiError(400,"Credentials are required")
    }

    const user = await User.findOne({
        $or: [{email}, {username}],
        isDeleted: false
    }).select("+password +refreshToken")

    if(!user){
        throw new ApiError(400,"User not found");
    }

    const isPasswordValid = await user.comparePassword(password);

    if(!isPasswordValid){
        throw new ApiError(401,"Invalid credentials")
    }
    
    const {accessToken, refreshToken} = await generateAccessAndRefereshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200, 
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged In Successfully"
        )
    )

})

const logout = asyncHandler(async (req,res) =>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1 
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"))
})

export {signUp, login, logout}