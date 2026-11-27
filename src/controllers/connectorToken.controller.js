import crypto from "crypto";
import { ConnectorToken } from "../models/connectorToken.models.js";
import { User } from "../models/users.models.js";
import { hashToken } from "../utils/hashToken.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const MAX_ACTIVE_TOKENS = 5;
const DEFAULT_TOKEN_NAME = "Claude connector";

const createConnectorToken = asyncHandler(async (req, res) => {
    const user = await User.findOne({
        _id: req.user._id,
        isDeleted: false,
    });

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    if (!user.verified) {
        throw new ApiError(403, "Please verify your account first");
    }

    const activeCount = await ConnectorToken.countDocuments({
        user: user._id,
        revokedAt: null,
    });

    if (activeCount >= MAX_ACTIVE_TOKENS) {
        throw new ApiError(
            400,
            "You can have at most 5 active connector tokens"
        );
    }

    let name = DEFAULT_TOKEN_NAME;
    if (typeof req.body?.name === "string") {
        const trimmed = req.body.name.trim();
        if (trimmed.length > 0 && trimmed.length <= 50) {
            name = trimmed;
        }
    }

    const raw = "fm_" + crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(raw);
    const last4 = raw.slice(-4);

    await ConnectorToken.create({
        user: user._id,
        name,
        tokenHash,
        last4,
    });

    return res.status(201).json(
        new ApiResponse(
            201,
            {
                token: raw,
                mcpUrl: `${process.env.MCP_BASE_URL}/mcp/${raw}`,
            },
            "Copy this now. It will not be shown again."
        )
    );
});

const listConnectorTokens = asyncHandler(async (req, res) => {
    const tokens = await ConnectorToken.find({
        user: req.user._id,
        revokedAt: null,
    })
        .sort({ createdAt: -1 })
        .select("name last4 lastUsedAt createdAt");

    return res.status(200).json(
        new ApiResponse(
            200,
            { tokens },
            "Connector tokens fetched successfully"
        )
    );
});

const revokeConnectorToken = asyncHandler(async (req, res) => {
    const token = await ConnectorToken.findOneAndUpdate(
        {
            _id: req.params.id,
            user: req.user._id,
            revokedAt: null,
        },
        { $set: { revokedAt: new Date() } },
        { new: true }
    );

    if (!token) {
        throw new ApiError(404, "Connector token not found");
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            null,
            "Connector token revoked successfully"
        )
    );
});

export {
    createConnectorToken,
    listConnectorTokens,
    revokeConnectorToken,
};
