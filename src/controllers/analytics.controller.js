import { Response } from "../models/responses.models.js";
import { Form } from "../models/forms.models.js";
import { Analytics } from "../models/analytics.model.js";
import { User } from "../models/users.models.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const normalizeQuestionType = (type) => {
  if (type === "select") return "radio";
  return type;
};

const toNumber = (value) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const computeNumberStats = (values) => {
  const numeric = values
    .map(toNumber)
    .filter((value) => value !== null);

  const count = numeric.length;
  if (count === 0) {
    return {
      min: null,
      max: null,
      mean: null,
      median: null,
      mode: null,
      count: 0,
    };
  }

  numeric.sort((a, b) => a - b);

  const min = numeric[0];
  const max = numeric[numeric.length - 1];
  const mean = numeric.reduce((sum, next) => sum + next, 0) / count;
  const median =
    count % 2 === 1
      ? numeric[Math.floor(count / 2)]
      : (numeric[count / 2 - 1] + numeric[count / 2]) / 2;

  const frequency = new Map();
  numeric.forEach((value) => {
    frequency.set(value, (frequency.get(value) || 0) + 1);
  });

  let mode = numeric[0];
  let maxFreq = 0;
  for (const [value, freq] of frequency.entries()) {
    if (freq > maxFreq) {
      maxFreq = freq;
      mode = value;
    }
  }

  return {
    min,
    max,
    mean,
    median,
    mode,
    count,
  };
};

const buildOptionStats = (values, options = []) => {
  const counter = new Map();

  const optionLabel = (value) => {
    const option = options.find((item) => item.value === value);
    return option ? option.label : value;
  };

  values.forEach((value) => {
    if (value === null || value === undefined) return;
    const key = optionLabel(value?.toString?.() ?? value);
    counter.set(key, (counter.get(key) || 0) + 1);
  });

  return Array.from(counter.entries()).map(([option, count]) => ({ option, count }));
};

const buildCheckboxStats = (values, options = []) => {
  const counter = new Map();

  const optionLabel = (value) => {
    const option = options.find((item) => item.value === value);
    return option ? option.label : value;
  };

  values.forEach((value) => {
    if (!Array.isArray(value)) return;
    value.forEach((item) => {
      if (item === null || item === undefined) return;
      const key = optionLabel(item?.toString?.() ?? item);
      counter.set(key, (counter.get(key) || 0) + 1);
    });
  });

  return Array.from(counter.entries()).map(([option, count]) => ({ option, count }));
};

const buildQuestionAnalytics = (question, rawValues) => {
  const type = normalizeQuestionType(question.type);
  const analytics = {
    questionId: question._id,
    type,
  };

  if (type === "number") {
    analytics.numberStats = computeNumberStats(rawValues);
    return analytics;
  }

  if (type === "radio") {
    analytics.optionStats = buildOptionStats(rawValues, question.options);
    return analytics;
  }

  if (type === "checkbox") {
    analytics.checkboxStats = buildCheckboxStats(rawValues, question.options);
    return analytics;
  }

  analytics.numberStats = {
    count: rawValues.filter((value) => value !== undefined && value !== null)
      .length,
  };
  return analytics;
};

const aggregateAnalytics = (form, responses) => {
  const answersByQuestion = new Map();

  responses.forEach((response) => {
    response.answers.forEach((answer) => {
      if (!answer?.questionId) return;
      const key = answer.questionId.toString();
      const list = answersByQuestion.get(key) || [];
      list.push(answer.value);
      answersByQuestion.set(key, list);
    });
  });

  const questionsAnalytics = form.questions.map((question) => {
    const rawValues = answersByQuestion.get(question._id.toString()) || [];
    return buildQuestionAnalytics(question, rawValues);
  });

  return {
    form: form._id,
    totalResponses: responses.length,
    questionsAnalytics,
    lastUpdated: new Date(),
  };
};

const validateFormOwner = (req, form) => {
   if (!req.user) {
      throw new ApiError(401, "Login required");
   }

   if (!form.author.equals(req.user._id)) {
      throw new ApiError(403, "Only the form owner can access analytics");
   }
};

const getFormAnalytics = asyncHandler(async (req, res) => {
  const slug = req.params.slug;
  const form = await Form.findOne({ formSlug: slug });

  if (!form) {
    throw new ApiError(404, "Form not found");
  }

  await validateFormOwner(req, form);

  if (form.analyticsUpToDate) {
    const cachedAnalytics = await Analytics.findOne({ form: form._id });
    if (cachedAnalytics) {
      return res.status(200).json(
        new ApiResponse(200, cachedAnalytics, "Analytics retrieved successfully")
      );
    }
  }

  const responses = await Response.find({ form: form._id });
  const analyticsData = aggregateAnalytics(form, responses);

  const analytics = await Analytics.findOneAndUpdate(
    { form: form._id },
    analyticsData,
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  await Form.updateOne(
    { _id: form._id },
    { analyticsUpToDate: true }
  );

  return res.status(200).json(
    new ApiResponse(200, analytics, "Analytics retrieved successfully")
  );
});

export { getFormAnalytics };
