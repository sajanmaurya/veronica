const {
  GoogleGenerativeAI,
} = require("@google/generative-ai");

const apiKey = process.env.NEXT_PUBLIC_GEMINI_KEY || process.env.GEMINI_KEY;

if (!apiKey) {
  console.error("Missing Gemini API key. Add NEXT_PUBLIC_GEMINI_KEY to your .env.local file.");
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

const model = genAI
  ? genAI.getGenerativeModel({
      model: DEFAULT_GEMINI_MODEL,
    })
  : null;

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
  responseMimeType: "text/plain",
};

export const chatSession = model ? model.startChat({ generationConfig }) : null;

export const isQuotaError = (error) => {
  const message = error?.message || JSON.stringify(error || {});
  return /429|quota|rate limit|exceeded your current quota|billing/i.test(message);
};

export const isModelUnavailableError = (error) => {
  const message = error?.message || JSON.stringify(error || {});
  return /404|no longer available|model.*not available|not found/i.test(message);
};

export const getGeminiFallbackResponse = (message = "The AI analysis service is currently unavailable because the Gemini quota limit has been reached. Please try again later or update your billing plan.") => ({
  rating: 0,
  harmful_ingredients: [],
  summary: message,
  user_specific_summary: "",
});

export const normalizeGeminiJson = (rawText) => {
  if (!rawText || typeof rawText !== "string") {
    return null;
  }

  const cleanedText = rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  if (!cleanedText) {
    return null;
  }

  try {
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error("Failed to parse Gemini JSON:", error);
    return null;
  }
};
