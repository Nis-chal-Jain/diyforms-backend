import mongoose from "mongoose";
import { Form } from "../models/forms.models.js";
import { FormsAccess } from "../models/formsacces.models.js";
import { User } from "../models/users.models.js";

import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const generateSlug = () => {

    const chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    let slug = "";

    for (let i = 0; i < 6; i++) {
        slug += chars.charAt(
            Math.floor(Math.random() * chars.length)
        );
    }

    return slug;
};

const createForm = asyncHandler(async (req, res) => {

    const session = await mongoose.startSession();

    try {

        session.startTransaction();

        // USER VALIDATION
        const user = await User.findOne({
            _id: req.user._id,
            isDeleted: false
        }).session(session);

        if (!user) {
            throw new ApiError(404, "User not found");
        }

        if (!user.verified) {
            throw new ApiError(
                403,
                "Please verify your account to create forms"
            );
        }

        // REQUEST BODY VALIDATION
        const {
            title,
            description,
            questions,
            settings,
            userarr = []
        } = req.body;

        if (!title || title.trim() === "") {
            throw new ApiError(
                400,
                "Title is required"
            );
        }

        if (
            !Array.isArray(questions) ||
            questions.length === 0
        ) {
            throw new ApiError(
                400,
                "At least one question is required"
            );
        }

        for (const question of questions) {

            if(!question.order){
                throw new ApiError(
                    400,
                    "Question order is required"
                );
            }
            if (!question.type) {
                throw new ApiError(
                    400,
                    "Question type is required"
                );
            }

            if (!question.label?.trim()) {
                throw new ApiError(
                    400,
                    "Question label is required"
                );
            }

            if (
                ["radio", "checkbox", "select"]
                    .includes(question.type)
            ) {

                if (
                    !Array.isArray(question.options) ||
                    question.options.length === 0
                ) {
                    throw new ApiError(
                        400,
                        `Options are required for ${question.type}`
                    );
                }
            }
        }
    
        // RESTRICTED FORM VALIDATION
        const uniqueUsersEmail = [...new Set(userarr)];

        if (
            settings?.restricted &&
            uniqueUsersEmail.length === 0 &&
            settings?.status !== "draft"
        ) {
            throw new ApiError(
                400,
                "Restricted forms require allowed users"
            );
        }

        // GENERATE UNIQUE SLUG
        let formSlug;

        do {
            formSlug = generateSlug();
        } while (
            await Form.findOne({ formSlug })
                .session(session)
        );

        // CREATE FORM
        const form = await Form.create(
            [{
                formSlug,
                title: title.trim(),
                description,
                questions,
                settings: {
                    status:
                        settings?.status || "draft",

                    restricted:
                        settings?.restricted || false
                },
                author: req.user._id
            }],
            { session }
        );

        const createdForm = form[0];

        // CREATE ACCESS ENTRIES
        if (uniqueUsersEmail.length > 0) {

            const formAccessEntries =
                uniqueUsersEmail.map(userEmail => ({
                    form: createdForm._id,
                    userEmail
                }))

            await FormsAccess.insertMany(
                formAccessEntries,
                {
                    session,
                    ordered: true
                }
            );
        }

        // UPDATE USER STATS
        await User.updateOne(
            {
                _id: req.user._id
            },
            {
                $inc: {
                    "usage.formsCreated": 1,
                    "formLimits.monthlyCreated": 1
                },
                $set: {
                    lastformCreatedAt: new Date()
                }
            },
            { session }
        );

        // COMMIT TRANSACTION
        await session.commitTransaction();

        return res.status(201).json(
            new ApiResponse(
                201,
                createdForm,
                "Form created successfully"
            )
        );

    } catch (error) {

        await session.abortTransaction();

        throw error;

    } finally {

        session.endSession();
    }
});

const getForms = asyncHandler(async (req, res) => {

    const slug = req.params.slug;

    const form = await Form.findOne({
        formSlug: slug
    });

    if (!form) {
        throw new ApiError(404, "Form not found");
    }

    // PUBLIC FORM → no login needed
    if (!form.settings.restricted) {
        return res.status(200).json(
            new ApiResponse(
                200,
                form,
                "Form retrieved successfully"
            )
        );
    }

    // RESTRICTED FORM → login required
    if (!req.user) {
        throw new ApiError(401, "Login required");
    }

    const user = await User.findById(req.user._id);

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const accessEntry = await FormsAccess.findOne({
        form: form._id,
        userEmail: user.email
    });

    if (!accessEntry) {
        throw new ApiError(403, "Access denied");
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            form,
            "Form retrieved successfully"
        )
    );
});

export { createForm, getForms };