import mongoose from "mongoose";
import { Form } from "../models/forms.models.js";
import { FormsAccess } from "../models/formsacces.models.js";
import { User } from "../models/users.models.js";
import { Response } from "../models/responses.models.js";
import redis from "../db/redis.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { validateQuestions } from "../utils/validateQuestions.js";

const FORM_STATUSES = ["draft", "published", "archived"];

const getEffectivePlan = (user) => {
    const subscription = user.subscription || {};
    const validTill = subscription.validTill;
    const expired = validTill && new Date(validTill).getTime() < Date.now();
    if (subscription.isActive === false || expired) {
        return "free";
    }
    return subscription.plan || "free";
};

const isEarlierCalendarMonthUtc = (date, now) => {
    if (!date) return true;
    const last = new Date(date);
    return (
        last.getUTCFullYear() < now.getUTCFullYear() ||
        (last.getUTCFullYear() === now.getUTCFullYear() &&
            last.getUTCMonth() < now.getUTCMonth())
    );
};

async function setFormInCache(form) {
    if (!form?.formSlug) return;
    const cacheKey = `form:${form.formSlug}`;
    const payload = typeof form === "string" ? form : JSON.stringify(form);
    await redis.set(cacheKey, payload, "EX", 3600);
}

async function getFormFromCache(slug) {
    if (!slug) return null;
    const cacheKey = `form:${slug}`;
    const cachedForm = await redis.get(cacheKey);
    if (!cachedForm) return null;

    try {
        const parsed = JSON.parse(cachedForm);

        if (typeof parsed === "string") {
            return JSON.parse(parsed);
        }

        return parsed;
    } catch {
        return null;
    }
}
async function deleteFormFromCache(slug) {
    if (!slug) return;
    const cacheKey = `form:${slug}`;
    await redis.del(cacheKey);
}
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

        const now = new Date();
        const needsMonthReset = isEarlierCalendarMonthUtc(
            user.formLimits?.lastReset,
            now
        );
        let monthlyCreated = user.formLimits?.monthlyCreated || 0;
        if (needsMonthReset) {
            monthlyCreated = 0;
        }

        const effectivePlan = getEffectivePlan(user);
        const freeLimit = Number(process.env.FREE_MONTHLY_FORMS || 3);
        if (effectivePlan === "free" && monthlyCreated >= freeLimit) {
            throw new ApiError(
                403,
                `Free plan limit reached: you can create ${freeLimit} forms per month. Upgrade to create more.`
            );
        }

        const isConnector = req.authMethod === "connector";

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

        if (title.trim().length > 200) {
            throw new ApiError(400, "Title must be at most 200 characters");
        }

        if (description !== undefined && description !== null) {
            if (typeof description !== "string") {
                throw new ApiError(400, "Description must be a string");
            }
            if (description.length > 2000) {
                throw new ApiError(400, "Description must be at most 2000 characters");
            }
        }

        validateQuestions(questions);

        const uniqueUsersEmail = isConnector ? [] : [...new Set(userarr)];

        const formStatus = isConnector
            ? "draft"
            : (settings?.status || "draft");
        const formRestricted = isConnector
            ? false
            : (settings?.restricted || false);

        if (
            formRestricted &&
            uniqueUsersEmail.length === 0 &&
            formStatus !== "draft"
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
                    status: formStatus,
                    restricted: formRestricted
                },
                author: req.user._id,
                source: isConnector ? "claude" : "dashboard"
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

        const userUpdate = {
            $inc: {
                "usage.formsCreated": 1
            },
            $set: {
                lastFormCreatedAt: new Date()
            }
        };

        if (needsMonthReset) {
            userUpdate.$set["formLimits.lastReset"] = now;
            userUpdate.$set["formLimits.monthlyCreated"] = 1;
        } else {
            userUpdate.$inc["formLimits.monthlyCreated"] = 1;
        }

        await User.updateOne(
            {
                _id: req.user._id
            },
            userUpdate,
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

const listMyForms = asyncHandler(async (req, res) => {
    const forms = await Form.find({ author: req.user._id })
        .sort({ createdAt: -1 })
        .select(
            "formSlug title description settings totalResponses createdAt updatedAt source"
        );

    return res.status(200).json(
        new ApiResponse(
            200,
            { forms },
            "Forms fetched successfully"
        )
    );
});

const getForms = asyncHandler(async (req, res) => {

    const slug = req.params.slug;
    let form = await getFormFromCache(slug);
    if(!form) {
        form = await Form.findOne({ formSlug: slug });
        if(form) await setFormInCache(form);
    }
    if (!form) {
        throw new ApiError(404, "Form not found");
    }

    const isAuthor =
        req.user?._id &&
        form.author.toString() === req.user._id.toString();

    if (isAuthor) {
        return res.status(200).json(
            new ApiResponse(
                200,
                form,
                "Form retrieved successfully"
            )
        );
    }

    if (form.settings.status !== "published") {
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

    const alreadySubmitted = await Response.findOne({
        form: form._id,
        email: user.email
    });
    
    if(alreadySubmitted) {
        throw new ApiError(400, "You have already submitted this form")
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            form,
            "Form retrieved successfully"
        )
    );
});

const updateForm = asyncHandler(async (req, res) => {
    const slug = req.params.slug;

    const form = await Form.findOne({
        formSlug: slug,
    })
    if (!form) {
        throw new ApiError(404, "Form not found");
    }

    if (form.author.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You don't have permission to update this form");
    }

    const isConnector = req.authMethod === "connector";

    if (isConnector) {
        if (form.settings?.status !== "draft") {
            throw new ApiError(
                403,
                `Claude can only edit drafts. This form is ${form.settings?.status}; the user must edit it in the dashboard.`
            );
        }
        if (Object.prototype.hasOwnProperty.call(req.body || {}, "settings")) {
            throw new ApiError(403, "Claude cannot change form settings");
        }
    }

    const { title, description, questions, settings } = req.body || {};
    const $set = {};

    if (title !== undefined) {
        if (typeof title !== "string" || title.trim() === "") {
            throw new ApiError(400, "Title is required");
        }
        if (title.trim().length > 200) {
            throw new ApiError(400, "Title must be at most 200 characters");
        }
        $set.title = title.trim();
    }

    if (description !== undefined) {
        if (typeof description !== "string") {
            throw new ApiError(400, "Description must be a string");
        }
        if (description.length > 2000) {
            throw new ApiError(400, "Description must be at most 2000 characters");
        }
        $set.description = description;
    }

    if (questions !== undefined) {
        if (form.totalResponses > 0) {
            throw new ApiError(
                400,
                "This form already has responses, so its questions can't be changed."
            );
        }
        validateQuestions(questions);
        $set.questions = questions;
    }

    if (!isConnector && settings !== undefined) {
        if (settings === null || typeof settings !== "object" || Array.isArray(settings)) {
            throw new ApiError(400, "Invalid settings");
        }
        if (settings.status !== undefined) {
            if (!FORM_STATUSES.includes(settings.status)) {
                throw new ApiError(400, "Invalid form status");
            }
            $set["settings.status"] = settings.status;
        }
        if (settings.restricted !== undefined) {
            $set["settings.restricted"] = Boolean(settings.restricted);
        }
    }

    if (Object.keys($set).length === 0) {
        throw new ApiError(400, "No valid fields to update");
    }

    const updatedForm = await Form.findOneAndUpdate(
        { formSlug: slug },
        { $set },
        { new: true }
    );

    await deleteFormFromCache(slug);

    return res.status(200).json(
        new ApiResponse(
            200,
            updatedForm,
            "Form updated successfully"
        )
    );
});

const deleteForm = asyncHandler(async (req, res) => {
    const slug = req.params.slug;
    const user = await User.findById(req.user._id);

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const form = await Form.findOne({ formSlug: slug });

    if (!form) {
        throw new ApiError(404, "Form not found");
    }

    if (user._id.toString() !== form.author.toString()) {
        throw new ApiError(403, "You don't have permission to delete this form");
    }

    await Form.findOneAndDelete({ formSlug: slug });
    await deleteFormFromCache(slug);
    return res.status(200).json(
        new ApiResponse(
            200,
            null,
            "Form deleted successfully"
        )
    );
})

const stopResponse = asyncHandler(async (req, res) => {
    const slug = req.params.slug;
    const form = await Form.findOne({
        formSlug: slug,
    });
    const user = await User.findById(req.user._id);
    if(!form) {
        throw new ApiError(404, "Form not found");
    }
    if (!user) {
        throw new ApiError(404, "User not found");
    }
    if(user._id.toString() !== form.author.toString()) {
        throw new ApiError(403, "You don't have permission to stop responses for this form");
    }
    if (form.settings.status === "archived") {
        throw new ApiError(400, "This form is already archived");
    }

    const updatedForm = await Form.findOneAndUpdate(
        { formSlug: slug },
        { $set: { "settings.status": "archived" } },
        { new: true }
    );

    await deleteFormFromCache(slug);

    return res.status(200).json(
        new ApiResponse(
            200,
            updatedForm,
            "Form responses stopped successfully"
        )
    )
})

const resumeResponse = asyncHandler(async (req, res) => {
    
    const slug = req.params.slug;
    const form = await Form.findOne({
        formSlug: slug,
    });
    const user = await User.findById(req.user._id);
    if(!form) {
        throw new ApiError(404, "Form not found");
    }
    if (!user) {
        throw new ApiError(404, "User not found");
    }
    if(user._id.toString() !== form.author.toString()) {
        throw new ApiError(403, "You don't have permission to resume responses for this form");
    }
    if (form.settings.status === "published") {
        throw new ApiError(400, "This form is already published");
    }
    
    const updatedForm = await Form.findOneAndUpdate(
        { formSlug: slug },
        { $set: { "settings.status": "published" } },
        { new: true }
    );

    await deleteFormFromCache(slug);
    
    return res.status(200).json(
        new ApiResponse(
            200,
            updatedForm,
            "Form responses resumed successfully"
        )
    )
})
export { createForm, listMyForms, getForms, updateForm, deleteForm, stopResponse, resumeResponse };
