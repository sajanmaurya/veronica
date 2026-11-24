import { analyzeLabelColumns, labelSchema } from "@/lib/labelColumns.mjs";

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
    .replace(/^\s*```json\s*/i, "")
    .replace(/^\s*```\s*/i, "")
    .replace(/\s*```\s*$/i, "")
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

const transcriptionProperties = {
  is_food_product: { type: "boolean" },
  product_name: { type: "string" },
  product_category: { type: "string" },
  nutrition: labelSchema,
};
const transcriptionSchema = {
  type: "object",
  additionalProperties: false,
  properties: transcriptionProperties,
  required: Object.keys(transcriptionProperties),
};

const foodAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    ...transcriptionProperties,
    package_quantity: { type: ["string", "null"] },
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
    "package_quantity",
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
- Net package quantity / pack size (for example 200 g, 1 kg, 500 ml) when visibly printed
- The complete visible ingredient list, in the order shown
- Major ingredients worth highlighting
- Nutrition Facts
- Serving size
- The exact nutrition-panel basis: whether the values are "per serving", "per container", "per 100 g", or "per 100 ml"
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

2. Do not generate any rating, score, grade, or consumption-frequency recommendation. The server calculates nutrition grades using fixed rules.

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

9. Describe the visible nutrition facts without making consumption-frequency recommendations.

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
- Transcribe every visible nutrition column separately, in printed order, with its exact heading. Include any % daily intake or RDA column with its original heading. Use an empty columns array when there is no readable panel.
- If a Nutrition Facts table repeats its headers side by side for different nutrient rows, combine the rows under their matching headers. Keep per serving, per container and % Daily Value quantities separate. A bare number under Calories is in kcal. Leave energy with no printed unit or Calories heading null.
- Include the printed number, decimal precision, unit, and any inequality in each cell (e.g. "910 kJ", "6.20 g", "≤17.17 g"). Units or limits printed on the row or table heading apply to that cell. Keep unreadable cells null. Never borrow a number from a neighbouring column.
- Transcribe energy in its printed unit: use energy_kj for kJ, calories for kcal or food Calories. If both are printed, transcribe each. Never convert or calculate either. Distinguish salt from sodium and total sugars from added sugars.
- Return the explicit weight or volume of one serving (e.g. "42 g"), or null. Do not substitute pack weight. Return panel_box as [left,top,right,bottom] on a 0–1000 scale relative to the uploaded image, or null when uncertain.
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
- "package_quantity" must contain only the exact net quantity visibly printed on the package, including its unit. Return null when it cannot be read confidently.
- Never infer pack size from product name, serving size, or prior knowledge.
- Keep user_specific_summary as an empty string when the profile does not contain relevant information.

Return data matching the supplied JSON schema.
`;

    const imageDataUrl =
      `data:${imageFile.mimetype || "image/jpeg"};base64,${imageBuffer.toString("base64")}`;

    const request = {
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
    };
    const readLabel = async (payload) => {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      return { response, result, data: response.ok ? cleanJson(result?.choices?.[0]?.message?.content) : null };
    };
    let { response, result, data } = await readLabel(request);
    let label = data?.is_food_product ? analyzeLabelColumns(data, data.nutrition) : null;
    const formatError = response.status === 400 && (result?.error?.code === "json_validate_failed" ||
      /failed to generate json/i.test(result?.error?.message || ""));
    if (formatError || (response.ok && !data) || label?.nutrition_validation.status === "needs_verification") {
      // A second, smaller request reads the nutrition table in isolation. Keep the
      // original analysis if the second transcription also needs verification.
      const focused = await readLabel({
        ...request,
        temperature: 0,
        messages: [{ role: "user", content: [
          { type: "text", text: `Read only the printed nutrition table. Return is_food_product false for a non-food image. Use the visible product name or "Unknown product" and a simple category such as Snacks, Biscuits or Beverages only when supported.
Copy all legible quantity columns, distinguishing per serving, per 100 g/ml, and per container. If headers repeat for different rows, combine the rows for each heading. Keep %DV out of quantities. Use one column per quantity basis. Preserve printed units and inequalities. A number printed under Calories is kcal. Do not calculate values or infer missing units. Copy the metric weight or volume of one serving, preserving any household measure. Use null for unreadable cells and an empty columns array only if no quantity column is legible.` },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ] }],
        response_format: { type: "json_schema", json_schema: {
          name: "nutrition_transcription", strict: true, schema: transcriptionSchema,
        } },
      }).catch(() => null);
      const recovered = focused?.data;
      if (recovered && !data) {
        ({ response, result } = focused);
        data = { ingredients: [], major_ingredients: [], harmful_ingredients: [], ingredient_explanations: [],
          package_quantity: null, summary: "", user_specific_summary: "", ...recovered };
        label = data.is_food_product ? analyzeLabelColumns(data, data.nutrition) : null;
      } else if (data && recovered?.is_food_product) {
        const candidate = { ...data, nutrition: recovered.nutrition };
        if (!candidate.product_category || candidate.product_category === "Unknown") candidate.product_category = recovered.product_category;
        const checked = analyzeLabelColumns(candidate, candidate.nutrition);
        if (checked.nutrition_validation.status === "extracted" ||
            (!data.nutrition?.columns?.length && candidate.nutrition?.columns?.length)) {
          data = candidate;
          label = checked;
        }
      }
    }

    if (!response.ok) {
      console.error("Image provider rejected the request:", response.status, result?.error?.code);

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

    Object.assign(data, label);
    data.ingredients_source =
      Array.isArray(data.ingredients) && data.ingredients.length
        ? "package_scan"
        : "unavailable";
    data.data_sources = {
      ingredients: data.ingredients_source,
      nutrition: data.nutrition_source,
      quantity: data.package_quantity ? "package_scan" : "unavailable",
      web: null,
    };
    data.product_quantity = data.package_quantity || null;
    data.pack_size_verified = Boolean(data.package_quantity);
    data.verification_required =
      data.ingredients_source === "unavailable" ||
      data.nutrition_source === "unavailable" ||
      !data.package_quantity ||
      !data.nutrition_score.grade;

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
