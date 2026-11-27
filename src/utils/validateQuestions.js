import { ApiError } from "./ApiError.js";

const ALLOWED_TYPES = ["text", "textarea", "number", "radio", "checkbox", "select"];
const OPTION_TYPES = ["radio", "checkbox", "select"];
const TEXT_TYPES = ["text", "textarea", "number"];

export const validateQuestions = (questions) => {
    if (!Array.isArray(questions) || questions.length === 0) {
        throw new ApiError(400, "At least one question is required");
    }

    if (questions.length > 50) {
        throw new ApiError(400, "A form can have at most 50 questions");
    }

    const seenOrders = new Set();

    for (const question of questions) {
        if (question.order === undefined || question.order === null) {
            throw new ApiError(400, "Question order is required");
        }

        if (typeof question.order !== "number" || question.order <= 0) {
            throw new ApiError(400, "Question order must be a positive number");
        }

        if (seenOrders.has(question.order)) {
            throw new ApiError(400, "Question order must be unique");
        }
        seenOrders.add(question.order);

        if (!question.type) {
            throw new ApiError(400, "Question type is required");
        }

        if (!ALLOWED_TYPES.includes(question.type)) {
            throw new ApiError(
                400,
                "Question type must be one of text, textarea, number, radio, checkbox, select"
            );
        }

        if (!question.label?.trim()) {
            throw new ApiError(400, "Question label is required");
        }

        if (question.label.trim().length > 200) {
            throw new ApiError(400, "Question label must be at most 200 characters");
        }

        if (OPTION_TYPES.includes(question.type)) {
            if (!Array.isArray(question.options) || question.options.length === 0) {
                throw new ApiError(
                    400,
                    `Options are required for ${question.type}`
                );
            }

            if (question.options.length > 50) {
                throw new ApiError(
                    400,
                    `A ${question.type} question can have at most 50 options`
                );
            }

            const seenValues = new Set();

            for (const option of question.options) {
                if (
                    typeof option?.label !== "string" ||
                    option.label.trim() === "" ||
                    typeof option?.value !== "string" ||
                    option.value.trim() === ""
                ) {
                    throw new ApiError(
                        400,
                        "Each option must have a non-empty string label and value"
                    );
                }

                if (seenValues.has(option.value)) {
                    throw new ApiError(
                        400,
                        "Option values must be unique within a question"
                    );
                }
                seenValues.add(option.value);
            }
        }

        if (
            TEXT_TYPES.includes(question.type) &&
            Array.isArray(question.options) &&
            question.options.length > 0
        ) {
            throw new ApiError(
                400,
                `Options are not allowed for ${question.type} questions`
            );
        }
    }
};
