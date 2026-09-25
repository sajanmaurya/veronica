import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = {
  api: {
    bodyParser: false,
  },
};

const apiKey =
  process.env.GEMINI_KEY ||
  process.env.NEXT_PUBLIC_GEMINI_KEY;

const MODEL_NAME = "gemini-3.8-flash";

function cleanJson(text) {
  if (!text || typeof text !== "string") {
    return null;
  }

  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);

    if (!match) {
      return null;
    }

    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  try {
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "Gemini API key is not configured.",
      });
    }

    const formidable = (await import("formidable")).default;

    const form = formidable({
      multiples: false,
      maxFileSize: 10 * 1024 * 1024,
      filter: ({ mimetype }) =>
        !!mimetype && mimetype.startsWith("image/"),
    });

    const [fields, files] = await form.parse(req);

    const uploadedImage = files.image;

    const imageFile = Array.isArray(uploadedImage)
      ? uploadedImage[0]
      : uploadedImage;

    if (!imageFile) {
      return res.status(400).json({
        success: false,
        error: "No image uploaded.",
      });
    }

    const fs = await import("fs");

    const imagePath =
      imageFile.filepath || imageFile.path;

    if (!imagePath || !fs.existsSync(imagePath)) {
      return res.status(400).json({
        success: false,
        error: "Uploaded image is invalid.",
      });
    }

    const imageBuffer = fs.readFileSync(imagePath);

    let profile = {};

    try {
      const profileValue = Array.isArray(fields.profile)
        ? fields.profile[0]
        : fields.profile;

      profile = profileValue
        ? JSON.parse(profileValue)
        : {};
    } catch {
      profile = {};
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
      },
    });

    const prompt = `
You are a professional nutritionist and food safety expert.

Analyze the food product shown in the uploaded image.

Read the visible:
- Product name
- Ingredients
- Nutrition information
- Allergens
- Additives
- Preservatives
- Artificial colors
- Sugar
- Sodium
- Saturated fat
- Trans fat

Tasks:

1. Give a health rating from 1 to 10.

2. Identify concerning or potentially harmful ingredients.

3. Consider:
- Added sugar
- Saturated fat
- Trans fat
- Sodium
- Preservatives
- Artificial colors
- Allergens
- Highly processed ingredients

4. Give a concise overall health summary.

5. State whether the product is more suitable for:
- frequent consumption
- occasional consumption
- rare consumption

6. If the user has relevant diseases or allergies,
provide a personalized summary.

User profile:

${JSON.stringify({
  diseases: profile?.diseases || null,
  allergies: profile?.allergies || null,
})}

Return ONLY valid JSON.

Use exactly this structure:

{
  "rating": number,
  "harmful_ingredients": [
    {
      "name": "Ingredient Name",
      "impact": "Explanation"
    }
  ],
  "summary": "Brief health summary",
  "user_specific_summary": "Personalized summary or empty string"
}

Do not use markdown.

Do not invent nutrition values that cannot be read
from the image.
`;

    // Retry Gemini if the service temporarily returns 503
    let result;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        result = await model.generateContent([
          {
            text: prompt,
          },
          {
            inlineData: {
              mimeType:
                imageFile.mimetype || "image/jpeg",
              data: imageBuffer.toString("base64"),
            },
          },
        ]);

        // Successful request
        break;
      } catch (error) {
        const message = error?.message || "";

        const isTemporaryError =
          /503|service unavailable|high demand|temporarily/i.test(
            message
          );

        if (!isTemporaryError || attempt === 3) {
          throw error;
        }

        const delay = attempt * 2000;

        console.log(
          `Gemini temporarily unavailable. Retry ${attempt}/3 after ${delay}ms`
        );

        await new Promise((resolve) =>
          setTimeout(resolve, delay)
        );
      }
    }

    if (!result) {
      throw new Error(
        "Gemini did not return a response after retries."
      );
    }

    const text =
      result.response?.text?.() || "";

    console.log(
      "Gemini image analysis:",
      text
    );

    const data = cleanJson(text);

    if (!data) {
      return res.status(502).json({
        success: false,
        error:
          "Gemini returned an invalid response. Please try again.",
      });
    }

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(
      "Image analysis error:",
      error
    );

    const message =
      error?.message || "";

    if (
      /429|quota|rate limit|billing/i.test(
        message
      )
    ) {
      return res.status(429).json({
        success: false,
        error:
          "Gemini API quota has been reached. Please try again later.",
      });
    }

    if (
      /404|not found|not available/i.test(
        message
      )
    ) {
      return res.status(502).json({
        success: false,
        error:
          "The configured Gemini model is unavailable.",
      });
    }

    if (
      /503|service unavailable|high demand|temporarily/i.test(
        message
      )
    ) {
      return res.status(503).json({
        success: false,
        error:
          "Gemini is temporarily overloaded. Please try again in a few seconds.",
      });
    }

    return res.status(500).json({
      success: false,
      error:
        "Unable to analyze the image right now. Please try again.",
    });
  }
}
