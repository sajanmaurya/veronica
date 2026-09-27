export const config = {
  api: {
    bodyParser: false,
  },
};

const MODEL_NAME = "qwen/qwen3.8-27b";

function parseServingGrams(servingSize) {
  if (!servingSize || typeof servingSize !== "string") return null;

  const match = servingSize.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(g|gram|grams)\b/i);
  return match ? Number(match[1]) : null;
}

function roundNumber(value, decimals = 2) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const factor = 10 ** decimals;
  return Math.round(Number(value) * factor) / factor;
}

function normalizeNutrition(nutrition) {
  if (!nutrition || typeof nutrition !== "object") {
    return {
      nutrition: nutrition || {},
      validation: {
        status: "needs_verification",
        message: "Nutrition data could not be validated.",
        basis: "unknown",
      },
    };
  }

  const result = { ...nutrition };
  const servingGrams = parseServingGrams(result.serving_size);
  const massFields = [
    "total_fat_g",
    "saturated_fat_g",
    "trans_fat_g",
    "carbohydrates_g",
    "fiber_g",
    "total_sugar_g",
    "added_sugar_g",
    "protein_g",
  ];

  const macroSum = massFields
    .filter((key) => key !== "fiber_g")
    .reduce((sum, key) => sum + (Number(result[key]) || 0), 0);

  let convertedFrom100g = false;

  // A common label-reading failure is returning the per-100 g column
  // while reporting the package serving size. If the numbers cannot
  // physically fit inside the stated gram serving, and they look like
  // a normal per-100 g nutrition panel, convert them.
  if (
    servingGrams &&
    servingGrams < 100 &&
    macroSum > servingGrams * 1.15 &&
    macroSum >= 70 &&
    macroSum <= 120
  ) {
    const factor = servingGrams / 100;

    for (const key of massFields) {
      if (result[key] != null) {
        result[key] = roundNumber(Number(result[key]) * factor);
      }
    }

    if (result.calories != null) {
      result.calories = roundNumber(Number(result.calories) * factor);
    }

    if (result.sodium_mg != null) {
      result.sodium_mg = roundNumber(Number(result.sodium_mg) * factor);
    }

    result.label_basis = "per_serving";
    convertedFrom100g = true;
  }

  const fat = Number(result.total_fat_g);
  const carbs = Number(result.carbohydrates_g);
  const protein = Number(result.protein_g);
  const calories = Number(result.calories);

  const estimatedCalories =
    (Number.isFinite(fat) ? fat * 9 : 0) +
    (Number.isFinite(carbs) ? carbs * 4 : 0) +
    (Number.isFinite(protein) ? protein * 4 : 0);

  const hasCoreMacros =
    Number.isFinite(fat) &&
    Number.isFinite(carbs) &&
    Number.isFinite(protein) &&
    Number.isFinite(calories);

  const caloriesConsistent =
    !hasCoreMacros ||
    (estimatedCalories > 0 &&
      calories >= estimatedCalories * 0.45 &&
      calories <= estimatedCalories * 1.35);

  const servingPhysicallyPlausible =
    !servingGrams ||
    massFields
      .filter((key) => result[key] != null)
      .every((key) => Number(result[key]) <= servingGrams * 1.05);

  const status =
    caloriesConsistent && servingPhysicallyPlausible
      ? "verified"
      : "needs_verification";

  let message = "Nutrition values passed basic consistency checks.";

  if (convertedFrom100g) {
    message =
      "The label appeared to show per-100 g values, so Veronica converted them to the stated serving size.";
  } else if (!caloriesConsistent) {
    message =
      "Calories do not closely match the reported macronutrients. Verify the nutrition panel before relying on these values.";
  } else if (!servingPhysicallyPlausible) {
    message =
      "One or more nutrient quantities exceed the stated serving size. Verify the nutrition panel.";
  }

  return {
    nutrition: result,
    validation: {
      status,
      message,
      basis: convertedFrom100g ? "converted_from_per_100g" : result.label_basis || "unknown",
    },
  };
}

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
        label_basis: {
          type: "string",
          enum: ["per_serving", "per_100g", "per_100ml", "unknown"],
        },
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
        "label_basis",
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
    ingredients: {
      type: "array",
      items: { type: "string" },
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
    "ingredients",
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
- The complete visible ingredient list, in the order shown
- Major ingredients worth highlighting
- Nutrition Facts
- Serving size
- The exact nutrition-panel basis: whether the values are "per serving", "per 100 g", or "per 100 ml"
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

4. Give a concise overall health summary in 2-3 sentences. Do not write a long paragraph.

5. Extract the visible ingredient list into "ingredients". Preserve the ingredient names as written, in order. Do not invent ingredients.

6. Select the most important ingredients to highlight in "major_ingredients". Use the visible ingredient list as the source.

7. State whether the product is more suitable for:
- frequent consumption
- occasional consumption
- rare consumption

8. If the user has relevant diseases or allergies, provide a personalized summary.

User profile:
${JSON.stringify({
  diseases: profile?.diseases || null,
  allergies: profile?.allergies || null,
})}

IMPORTANT DATA RULES:

- Report the nutrition-panel basis in "label_basis" exactly from the visible label.
- If the panel is per 100 g or per 100 ml, do NOT pretend those numbers are per serving.
- Nutrition values should be transcribed from the visible panel; the server will handle a safe per-100 g to serving conversion when the serving size is clearly available.
- Never silently change values because they "seem healthy" or "seem reasonable".
- Do NOT estimate or guess nutrition numbers.
- If a nutrition value cannot be read confidently, return null.
- If the package has multiple nutrition panels, use the panel that is clearly associated with the product.
- "ingredients" should contain only ingredients that can be read from the image.
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

    const normalized = normalizeNutrition(data.nutrition);
    data.nutrition = normalized.nutrition;
    data.nutrition_validation = normalized.validation;

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
