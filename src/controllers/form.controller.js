import { Form } from "../models/forms.models.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/users.models.js";

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
    const userid = req.user._id;

    const user = await User.findById(userid)

    const {
        title,
        description,
        questions,
        settings
    } = req.body;

    if (!title || title.trim() === "") {
        throw new ApiError(400, "Title is required");
    }

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
        throw new ApiError(400, "At least one question is required");
    }

    // Validate questions
    for (const question of questions) {

        if (!question.type) {
            throw new ApiError(400, "Question type is required");
        }

        if (!question.label || question.label.trim() === "") {
            throw new ApiError(400, "Question label is required");
        }

        // Validate options
        if (
            ["radio", "checkbox", "select"].includes(question.type)
        ) {
            if (
                !question.options ||
                !Array.isArray(question.options) ||
                question.options.length === 0
            ) {
                throw new ApiError(
                    400,
                    `Options are required for ${question.type} type`
                );
            }
        }
    }

    // Generate unique 6-char slug
    let formSlug;

    do {
        formSlug = generateSlug();
    } while (await Form.findOne({ formSlug }));

    //TODO
    // add restricted logic here
    //

    const form = await Form.create({
        formSlug,
        title,
        description,
        questions,
        settings: {
            status: settings?.status || "draft",
            restricted: settings?.restricted || false
        },
        author: req.user._id
    });

    return res.status(201).json(
        new ApiResponse(
            201,
            form,
            "Form created successfully"
        )
    );
});

export { createForm };