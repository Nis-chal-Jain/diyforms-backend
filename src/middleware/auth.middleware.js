import JWT from 'jsonwebtoken'
import { ApiError } from '../utils/ApiError.js';

export const authMiddleware = (req, res, next) => {
    try {
        const userAccessToken = req.cookies?.accessToken || req.headers?.authorization?.replace("Bearer ", "")
    
        if(!userAccessToken){
            throw new ApiError(401, "Unauthorized")
        }
    
        const decoded = JWT.verify(userAccessToken, process.env.JWT_ACCESS_SECRET)
    
        req.user = decoded
        next()
    } catch (error) {
        next(new ApiError(401, "Invalid access token"))
    }
    
}

export const optionalAuthMiddleware = (req, res, next) => {
    try {
        const userAccessToken = req.cookies?.accessToken || req.headers?.authorization?.replace("Bearer ", "")
    
        if(!userAccessToken){
            req.user = null
            return next()
        }
    
        const decoded = JWT.verify(userAccessToken, process.env.JWT_ACCESS_SECRET)
    
        req.user = decoded
        next()
    } catch (error) {
        next()
    }
    
}
