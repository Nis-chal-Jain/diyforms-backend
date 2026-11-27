import JWT from 'jsonwebtoken'
import { ApiError } from '../utils/ApiError.js';
import { ConnectorToken } from '../models/connectorToken.models.js';
import { User } from '../models/users.models.js';
import { hashToken } from '../utils/hashToken.js';

const getBearer = (req) => req.headers?.authorization?.replace("Bearer ", "");

const authenticateConnector = async (token) => {
    const record = await ConnectorToken.findOne({
        tokenHash: hashToken(token),
        revokedAt: null,
    });
    if (!record) throw new ApiError(401, "Connector token is invalid or revoked");
    const alive = await User.exists({ _id: record.user, isDeleted: false });
    if (!alive) throw new ApiError(401, "Account not found");
    if (!record.lastUsedAt || Date.now() - record.lastUsedAt.getTime() > 60_000) {
        ConnectorToken.updateOne({ _id: record._id }, { lastUsedAt: new Date() }).catch(() => {});
    }
    return { _id: record.user.toString() };
};

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

export const authOrConnector = async (req, res, next) => {
    try {
        const bearer = getBearer(req);
        if (!bearer?.startsWith("fm_")) {
            return authMiddleware(req, res, next);
        }
        req.user = await authenticateConnector(bearer);
        req.authMethod = "connector";
        next();
    } catch (error) {
        next(error instanceof ApiError ? error : new ApiError(401, "Invalid access token"));
    }
};

export const optionalAuthOrConnector = async (req, res, next) => {
    try {
        const bearer = getBearer(req);
        if (!bearer?.startsWith("fm_")) {
            return optionalAuthMiddleware(req, res, next);
        }
        req.user = await authenticateConnector(bearer);
        req.authMethod = "connector";
        next();
    } catch (error) {
        next(error instanceof ApiError ? error : new ApiError(401, "Connector token is invalid or revoked"));
    }
};
