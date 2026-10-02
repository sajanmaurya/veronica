const MODEL_NAME = "qwen/qwen3.8-27b";

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    rating: { type: "number" },
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
    "rating",
    "harmful_ingredients",
    "summary",
    "user_specific_summary",
    "ingredient_explanations",
  ],
};


function buildBarcodeNutrition(product) {
  const source = product?.nutrients_per_100g || {};

  const numberOrNull = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };

  const sodiumGrams = numberOrNull(source.sodium);
  const servingSize =
    product?.serving_size && String(product.serving_size).toLowerCase() !== "unknown"
      ? product.serving_size
      : "per 100 g";

  return {
    serving_size: servingSize,
    label_basis: "per_100g",
    servings_per_container: null,
    calories: numberOrNull(source["energy-kcal"] ?? source.energy_kcal),
    total_fat_g: numberOrNull(source.fat),
    saturated_fat_g: numberOrNull(source["saturated-fat"] ?? source.saturated_fat),
    trans_fat_g: numberOrNull(source["trans-fat"] ?? source.trans_fat),
    carbohydrates_g: numberOrNull(source.carbohydrates),
    fiber_g: numberOrNull(source.fiber),
    total_sugar_g: numberOrNull(source.sugars ?? source.sugar),
    added_sugar_g: null,
    protein_g: numberOrNull(source.proteins ?? source.protein),
    sodium_mg: sodiumGrams == null ? null : Math.round(sodiumGrams * 1000),
  };
}

function cleanRating(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(10, Math.max(1, number));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ success: false, message: "GROQ_API_KEY is not configured." });
  }

  try {
    const { product, profile } = req.body || {};

    if (!product) {
      return res.status(400).json({ success: false, message: "Product data is required." });
    }

    const prompt = `
You are Veronica, a food-product nutrition and ingredient analyst.

Analyze the supplied product data. Use only information present in the product data; do not invent nutrition values or ingredients.

Give a practical general assessment. Do not diagnose, treat, or claim to medically clear a person.

Rating:
1-3 = poor nutritional profile
4-6 = mixed/moderate
7-10 = stronger nutritional profile

Consider sugar, saturated fat, sodium, protein, fiber, calories, ingredients, additives, and processing when the data contains them.

For harmful_ingredients, list only ingredients or nutritional characteristics that are actually supported by the supplied product data. Explain the possible concern briefly. Return an empty array when nothing significant is supported.

For user_specific_summary, use diseases, allergies, and dietary preferences only as context and avoid medical diagnosis. If the profile is empty, return an empty string.

For ingredient_explanations, explain only additives, preservatives, sweeteners, colors, emulsifiers, flavor enhancers, or other notable ingredients actually present in the supplied ingredient list. Keep each explanation to one short sentence. Return an empty array when there are no notable ingredients.

PRODUCT DATA:
${JSON.stringify(product)}

USER PROFILE:
${JSON.stringify({
  diseases: profile?.diseases || "",
  allergies: profile?.allergies || "",
  dietaryPreferences: profile?.dietaryPreferences || "",
})}
`;

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: "Return only the requested JSON object. Never invent missing product facts.",
          },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "barcode_product_analysis",
            strict: true,
            schema,
          },
        },
      }),
    });

    const raw = await groqResponse.text();

    if (!groqResponse.ok) {
      let details = raw;
      try {
        details = JSON.parse(raw)?.error?.message || raw;
      } catch {}
      return res.status(groqResponse.status).json({
        success: false,
        message: details || "Groq analysis failed.",
      });
    }

    const payload = JSON.parse(raw);
    const text = payload?.choices?.[0]?.message?.content;

    if (!text) {
      return res.status(502).json({ success: false, message: "Groq returned an empty analysis." });
    }

    const data = JSON.parse(text);

    // Open Food Facts already provides the ingredient list for barcode
    // products. Keep that source data in the final response instead of relying
    // on the AI to reproduce it.
    const sourceIngredients = String(product.ingredients || "").trim();
    const ingredients =
      sourceIngredients && sourceIngredients.toLowerCase() !== "unknown"
        ? sourceIngredients
            .split(/\s*,\s*/)
            .map((item) => item.trim())
            .filter(Boolean)
        : [];

    return res.status(200).json({
      success: true,
      data: {
        ...data,
        product_category: product.categories || product.pnns_groups_2 || product.pnns_groups_1 || "Unknown",
        ingredients,
        nutrition: buildBarcodeNutrition(product),
        nutrition_validation: {
          status: "verified",
          message: "Nutrition values came from the barcode product database.",
          basis: "per_100g",
        },
        nutriscore_grade: product.nutriscore_grade || null,
        nutriscore_score:
          product.nutriscore_score != null ? Number(product.nutriscore_score) : null,
        rating: cleanRating(data.rating),
      },
    });
  } catch (error) {
    console.error("Barcode Groq analysis failed:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to analyze the scanned product right now.",
    });
  }
}
