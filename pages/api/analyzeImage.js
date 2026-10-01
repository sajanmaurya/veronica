import { createNutritionSummary, normalizeNutrition } from "@/lib/nutrition.mjs";

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
    is_food_product: { type: "boolean" },
    product_name: { type: "string" },
    product_category: { type: "string" },
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
    ingredient_explanations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          purpose: { type: "string" },
          explanation: { type: "string" },
        },
        required: ["name", "purpose", "explanation"],
      },
    },
  },
  required: [
    "is_food_product",
    "product_name",
    "product_category",
    "rating",
    "nutrition",
    "ingredients",
    "major_ingredients",
    "harmful_ingredients",
    "summary",
    "user_specific_summary",
    "ingredient_explanations",
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

First determine whether the uploaded image actually shows a food or beverage product/package or a readable food label.

A valid image must contain a food/beverage product or its packaging/label. Examples include a packaged snack, biscuit packet, cereal box, beverage bottle, yogurt/dairy package, sauce, frozen food, or a clear ingredients/nutrition label.

If the image is unrelated to food (for example a laptop, phone, person, room, animal, vehicle, scenery, document unrelated to food, or any other non-food object), set "is_food_product" to false. In that case:
- Do not assign a health rating.
- Set "rating" to 0.
- Set "product_name" to "Unknown product".
- Set "product_category" to "Unknown".
- Return empty arrays for ingredients, major_ingredients, harmful_ingredients, and ingredient_explanations.
- Set nutrition fields to null where applicable.
- Set summary to a short message explaining that Veronica needs a food/beverage product or food label.
- Set user_specific_summary to an empty string.

Only if the image is actually a food/beverage product or food label should you perform the full analysis below.

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

1. Decide whether this is a food/beverage product or food label and set "is_food_product" accordingly. Never treat an unrelated object as a food product.

2. Give a health rating from 1 to 10 based on the visible nutrition and ingredient information. Only provide a non-zero rating when "is_food_product" is true.

3. Classify the product into a concise broad food category such as chips, biscuits, cereals, yogurt, dairy, beverages, sauces, frozen foods, snacks, or another specific category supported by the package. Do not invent a category.

4. Identify concerning or potentially harmful ingredients. Do not call an ingredient harmful merely because it is unfamiliar. Explain the relevant concern.

5. Consider:
- Added sugar
- Saturated fat
- Trans fat
- Sodium
- Preservatives
- Artificial colors
- Allergens
- Highly processed ingredients

6. Give a concise overall health summary in 2-3 sentences. Do not write a long paragraph.

7. Extract the visible ingredient list into "ingredients". Preserve the ingredient names as written, in order. Do not invent ingredients.

8. Select the most important ingredients to highlight in "major_ingredients". Use the visible ingredient list as the source.

9. State whether the product is more suitable for:
- frequent consumption
- occasional consumption
- rare consumption

10. If the user has relevant diseases, allergies, or dietary preferences, provide a personalized summary.

11. For "ingredient_explanations", explain only notable additives, preservatives, sweeteners, colors, emulsifiers, flavor enhancers, or other ingredients actually visible in the ingredient list. Keep each explanation short. Return an empty array when none are notable.

User profile:
${JSON.stringify({
  diseases: profile?.diseases || null,
  allergies: profile?.allergies || null,
  dietaryPreferences: profile?.dietaryPreferences || null,
})}

IMPORTANT DATA RULES:

- "is_food_product" must be false for unrelated images such as laptops, phones, people, rooms, vehicles, scenery, animals, or non-food documents.
- Never assign a health rating to a non-food image.
- Report the nutrition-panel basis in "label_basis" exactly from the visible label.
- If the panel is per 100 g or per 100 ml, do NOT pretend those numbers are per serving.
- Nutrition values should be transcribed from the visible panel; keep every value on that exact stated basis.
- Never silently change values because they "seem healthy" or "seem reasonable".
- Do NOT estimate or guess nutrition numbers.
- If a nutrition value cannot be read confidently, return null.
- If the package has multiple nutrition panels, use the panel that is clearly associated with the product.
- "ingredients" should contain only ingredients that can be read from the image.
- For major ingredients, only provide percentage when the percentage is explicitly visible.
- Only provide amount_g_per_serving when it is explicitly stated or can be directly calculated from a visible percentage and serving size.
- Never invent ingredient quantities.
- Product name must be "Unknown product" when it cannot be read with confidence.
- Product category must be a concise broad category supported by the visible package; use "Unknown" when it cannot be determined.
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

    if (data.is_food_product === false) {
      return res.status(422).json({
        success: false,
        error:
          "This does not appear to be a food or beverage product. Please upload a clear photo of the food package, ingredients list, or Nutrition Facts label.",
        code: "NOT_A_FOOD_PRODUCT",
      });
    }

    const normalized = normalizeNutrition(data.nutrition);
    data.nutrition = normalized.nutrition;
    data.nutrition_validation = normalized.validation;
    data.nutrition_source = { name: "Uploaded label photo", kind: "label_photo", url: null };
    data.nutrition_summary = createNutritionSummary(data.nutrition, data.nutrition_source);

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
