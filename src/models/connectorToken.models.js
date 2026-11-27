import mongoose from "mongoose";

const connectorTokenSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        name: {
            type: String,
            default: "Claude connector",
        },
        tokenHash: {
            type: String,
            required: true,
            unique: true,
        },
        last4: {
            type: String,
        },
        lastUsedAt: {
            type: Date,
        },
        revokedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

export const ConnectorToken = mongoose.model(
    "ConnectorToken",
    connectorTokenSchema
);
