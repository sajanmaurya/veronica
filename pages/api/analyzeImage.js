export const config = {
  api: {
    bodyParser: false,
  },
};

const MODEL_NAME = "qwen/qwen3.8-27b";

function cleanJson(text) {
  if (!text || typeof text !== "string") {
    return null;
  }

  const cleaned = text
    .replace(/^\s*\`\`\`json\s*/i, "")
    .replace(/^\s*\`\`\`\s*/i, "")
    .replace(/\s*\`\`\`\s*$/i, "")
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

const foodAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    product_name: { type: "string" },
    rating: { type: "number" },
    nutrition: {
      type: "object",
      additionalProperties: false,
      properties: {
        serving_size: { type: ["string", "null"] },
        servings_per_container: { type: ["number", "null"] },
        calories: { type: ["number", "null"] },
        total_fat_g: { type: ["number", "null"] },
        saturated_fat_g: { type: ["number", "null"] },
        trans_fat_g: { type: ["number", "null"] },
        carbohydrates_g: { type: ["number", "null"] },
        fiber_g: { type: ["number", "null"] },
        total_sugar_g: { type: ["number", "null"] },
        added_sugar_g: { type: ["number", "null"] },
        protein_g: { type: ["number", "null"] },
        sodium_mg: { type: ["number", "null"] },
      },
      required: [
        "serving_size",
        "servings_per_container",
        "calories",
        "total_fat_g",
        "saturated_fat_g",
        "trans_fat_g",
        "carbohydrates_g",
        "fiber_g",
        "total_sugar_g",
        "added_sugar_g",
        "protein_g",
        "sodium_mg",
      ],
    },
    major_ingredients: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          percentage: { type: ["number", "null"] },
          amount_g_per_serving: { type: ["number", "null"] },
        },
        required: [
          "name",
          "percentage",
          "amount_g_per_serving",
        ],
      },
    },
    harmful_ingredients: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          impact: { type: "string" },
        },
        required: ["name", "impact"],
      },
    },
    summary: { type: "string" },
    user_specific_summary: { type: "string" },
  },
  required: [
    "product_name",
    "rating",
    "nutrition",
    "major_ingredients",
    "harmful_ingredients",
    "summary",
    "user_specific_summary",
  ],
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  try {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "Groq API key is not configured.",
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

    const prompt = `
You are Veronica, a careful food-package analysis assistant.

Analyze the food product shown in the uploaded image.

Read only information that is actually visible in the image. Carefully inspect:
- Product name
- Ingredients
- Nutrition Facts
- Serving size
- Calories
- Total fat
- Saturated fat
- Trans fat
- Carbohydrates
- Fiber
- Total sugar
- Added sugar
- Protein
- Sodium
- Allergens
- Preservatives
- Artificial colors
- Other additives

Tasks:

1. Give a health rating from 1 to 10 based on the visible nutrition and ingredient information.

2. Identify concerning or potentially harmful ingredients. Do not call an ingredient harmful merely because it is unfamiliar. Explain the relevant concern.

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

6. If the user has relevant diseases or allergies, provide a personalized summary.

User profile:
${JSON.stringify({
  diseases: profile?.diseases || null,
  allergies: profile?.allergies || null,
})}

IMPORTANT DATA RULES:

- Nutrition values must represent the labeled serving.
- Do NOT convert a per-100g value into a serving value unless the serving size and calculation are directly available.
- Do NOT estimate or guess nutrition numbers.
- If a nutrition value cannot be read confidently, return null.
- If the package has multiple nutrition panels, use the panel that is clearly associated with the product.
- For major ingredients, only provide percentage when the percentage is explicitly visible.
- Only provide amount_g_per_serving when it is explicitly stated or can be directly calculated from a visible percentage and serving size.
- Never invent ingredient quantities.
- Product name must be "Unknown product" when it cannot be read with confidence.
- Keep user_specific_summary as an empty string when the profile does not contain relevant information.

Return data matching the supplied JSON schema.
`;

    const imageDataUrl =
      `data:${imageFile.mimetype || "image/jpeg"};base64,${imageBuffer.toString("base64")}`;

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL_NAME,
          reasoning_effort: "none",
          temperature: 0.2,
          max_completion_tokens: 4096,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: prompt,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: imageDataUrl,
                  },
                },
              ],
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "food_analysis",
              strict: true,
              schema: foodAnalysisSchema,
            },
          },
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("Groq API error:", result);

      const groqMessage =
        result?.error?.message ||
        "Groq image analysis request failed.";

      if (response.status === 429) {
        return res.status(429).json({
          success: false,
          error:
            "Groq API rate limit has been reached. Please try again later.",
        });
      }

      return res.status(502).json({
        success: false,
        error: groqMessage,
      });
    }

    const text =
      result?.choices?.[0]?.message?.content || "";

    console.log("Groq Qwen image analysis:", text);

    const data = cleanJson(text);

    if (!data) {
      return res.status(502).json({
        success: false,
        error:
          "Qwen returned an invalid response. Please try again.",
      });
    }

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Image analysis error:", error);

    const message =
      error?.message || "";

    if (/429|quota|rate limit/i.test(message)) {
      return res.status(429).json({
        success: false,
        error:
          "Groq API rate limit has been reached. Please try again later.",
      });
    }

    return res.status(500).json({
      success: false,
      error:
        "Unable to analyze the image right now. Please try again.",
    });
  }
}
