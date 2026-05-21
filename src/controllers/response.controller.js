import { Response } from "../models/responses.models.js";
import { Form } from "../models/forms.models.js";
import { User } from "../models/users.models.js";
import { FormsAccess } from "../models/formsacces.models.js";

import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const submitResponse = asyncHandler(async (req, res) => {

    const slug = req.params.slug;
    const { answers } = req.body;

    if (!slug || !answers || !Array.isArray(answers)) {
        throw new ApiError(400, "Invalid payload");
    }

    const form = await Form.findOne({
        formSlug: slug
    });

    if (!form) {
        throw new ApiError(404, "Form not found");
    }

    if (form.settings.status !== "published") {
        throw new ApiError(400, "Form is not active");
    }

    let email = null;

    // Restricted form logic
    if (form.settings.restricted) {

        if (!req.user) {
            throw new ApiError(
                401,
                "Please login to submit this form"
            );
        }

        const user = await User.findById(req.user._id)
            .select("email verified");

        if (!user) {
            throw new ApiError(404, "User not found");
        }

        if (user.verified === false) {
            throw new ApiError(
                403,
                "Please verify your email to submit this form"
            );
        }

        email = user.email;

        const access = await FormsAccess.findOne({
            form: form._id,
            email
        });

        if (!access) {
            throw new ApiError(
                403,
                "You don't have access to submit this form"
            );
        }

        const alreadySubmitted = await Response.findOne({
            form: form._id,
            email
        });

        if (alreadySubmitted) {
            throw new ApiError(
                400,
                "You have already submitted this form"
            );
        }
    }

    // Valid question ids
    const validQuestionIds = form.questions.map(q =>
        q._id.toString()
    );

    // Required questions
    const requiredQuestions = form.questions
        .filter(q => q.required)
        .map(q => q._id.toString());

    const answeredQuestionIds = answers.map(ans =>
        ans.questionId.toString()
    );

    // Check required questions
    for (const requiredId of requiredQuestions) {

        if (!answeredQuestionIds.includes(requiredId)) {
            throw new ApiError(
                400,
                "All required questions must be answered"
            );
        }
    }

    // Validate answers
    for (const ans of answers) {

        if (
            !ans.questionId ||
            ans.value === undefined
        ) {
            throw new ApiError(
                400,
                "Invalid answer format"
            );
        }

        if (
            !validQuestionIds.includes(
                ans.questionId.toString()
            )
        ) {
            throw new ApiError(
                400,
                `Invalid questionId: ${ans.questionId}`
            );
        }

        const question = form.questions.find(
            q => q._id.toString() === ans.questionId.toString()
        );

        // Type validation
        switch (question.type) {

            case "text":
            case "textarea":

                if (typeof ans.value !== "string") {
                    throw new ApiError(
                        400,
                        `${question.label} must be text`
                    );
                }

                if (
                    question.validation?.minLength &&
                    ans.value.length < question.validation.minLength
                ) {
                    throw new ApiError(
                        400,
                        `${question.label} is too short`
                    );
                }

                if (
                    question.validation?.maxLength &&
                    ans.value.length > question.validation.maxLength
                ) {
                    throw new ApiError(
                        400,
                        `${question.label} is too long`
                    );
                }

                break;

            case "number":

                if (typeof ans.value !== "number") {
                    throw new ApiError(
                        400,
                        `${question.label} must be number`
                    );
                }

                if (
                    question.validation?.min !== undefined &&
                    ans.value < question.validation.min
                ) {
                    throw new ApiError(
                        400,
                        `${question.label} is below minimum value`
                    );
                }

                if (
                    question.validation?.max !== undefined &&
                    ans.value > question.validation.max
                ) {
                    throw new ApiError(
                        400,
                        `${question.label} exceeds maximum value`
                    );
                }

                break;

            case "radio":
            case "select":

                if (typeof ans.value !== "string") {
                    throw new ApiError(
                        400,
                        `${question.label} must be string`
                    );
                }

                const validOption = question.options.some(
                    option => option.value === ans.value
                );

                if (!validOption) {
                    throw new ApiError(
                        400,
                        `Invalid option selected for ${question.label}`
                    );
                }

                break;

            case "checkbox":

                if (!Array.isArray(ans.value)) {
                    throw new ApiError(
                        400,
                        `${question.label} must be an array`
                    );
                }

                const validValues = question.options.map(
                    option => option.value
                );

                for (const value of ans.value) {

                    if (!validValues.includes(value)) {
                        throw new ApiError(
                            400,
                            `Invalid checkbox option for ${question.label}`
                        );
                    }
                }

                break;

            default:
                throw new ApiError(
                    400,
                    `Unsupported question type: ${question.type}`
                );
        }
    }

    // Create response
    const response = await Response.create({
        form: form._id,
        email,
        answers
    });

    // Update analytics
    await Form.findByIdAndUpdate(
        form._id,
        {
            $inc: {
                totalResponses: 1
            },
            analyticsUpToDate: false
        }
    );

    //author
    await User.findByIdAndUpdate(
        form.author._id,
        { $inc: { "usage.responsesCollected": 1 } }
    );

    return res.status(201).json(
        new ApiResponse(
            201,
            response,
            "Response submitted successfully"
        )
    );
});

const getFormForResponse = asyncHandler(async (req, res) => {

    const slug = req.params.slug;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const user = req.user;

    if (!user) {
        throw new ApiError(
            401,
            "Please login to access this data"
        );
    }

    const form = await Form.findOne({
        formSlug: slug
    });

    if (!form) {
        throw new ApiError(
            404,
            "Form not found"
        );
    }

    // Ownership check
    if (
        form.author.toString() !==
        user._id.toString()
    ) {
        throw new ApiError(
            403,
            "Unauthorized access"
        );
    }

    const total = await Response.countDocuments({
        form: form._id
    });

    const responseData = await Response.find({
        form: form._id
    })
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 });

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                responses: responseData,
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            },
            "Responses retrieved successfully"
        )
    );
});

export {
    submitResponse,
    getFormForResponse
};