import {
  enrichProductFromWeb,
  needsWebEnrichment,
} from "@/lib/productWebEnrichment";
import { validateBarcodeNutrition } from "@/lib/nutritionValidation";

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

function isUnknown(value) {
  const text = String(value ?? "").trim().toLowerCase();
  return !text || text === "unknown" || text === "n/a" || text === "null";
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function nutritionCount(nutrition) {
  return [
    nutrition.calories,
    nutrition.total_fat_g,
    nutrition.saturated_fat_g,
    nutrition.carbohydrates_g,
    nutrition.total_sugar_g,
    nutrition.protein_g,
    nutrition.sodium_mg,
  ].filter((value) => value != null).length;
}

function nutritionToProductShape(nutrition) {
  if (!nutrition) return {};

  return {
    "energy-kcal": nutrition.calories,
    fat: nutrition.total_fat_g,
    "saturated-fat": nutrition.saturated_fat_g,
    "trans-fat": nutrition.trans_fat_g,
    carbohydrates: nutrition.carbohydrates_g,
    fiber: nutrition.fiber_g,
    sugars: nutrition.total_sugar_g,
    added_sugar_g: nutrition.added_sugar_g,
    proteins: nutrition.protein_g,
    sodium_mg: nutrition.sodium_mg,
  };
}

function cleanRating(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(10, Math.max(1, number));
}

async function analyzeWithGroq(apiKey, product, profile) {
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

  const groqResponse = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
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
            content:
              "Return only the requested JSON object. Never invent missing product facts.",
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
    }
  );

  const raw = await groqResponse.text();

  if (!groqResponse.ok) {
    let details = raw;

    try {
      details = JSON.parse(raw)?.error?.message || raw;
    } catch {}

    throw new Error(details || "Groq analysis failed.");
  }

  const payload = JSON.parse(raw);
  const text = payload?.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error("Groq returned an empty analysis.");
  }

  return JSON.parse(text);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed." });
  }

  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      success: false,
      message: "GROQ_API_KEY is not configured.",
    });
  }

  try {
    const { product, profile } = req.body || {};

    if (!product) {
      return res.status(400).json({
        success: false,
        message: "Product data is required.",
      });
    }

    const enrichmentNeed = needsWebEnrichment(product);
    const offValidation = validateBarcodeNutrition(product);
    let webEnrichment = null;

    if (enrichmentNeed.required || offValidation.requires_fallback) {
      try {
        webEnrichment = await enrichProductFromWeb(product, apiKey);
      } catch (error) {
        // Web recovery is a fallback only. A search outage must never break
        // an otherwise usable barcode scan.
        console.warn("Barcode web enrichment failed:", error?.message || error);
      }
    }

    const sourceIngredients = String(product.ingredients || "").trim();
    const offIngredients =
      sourceIngredients && sourceIngredients.toLowerCase() !== "unknown"
        ? sourceIngredients
            .split(/\s*,\s*/)
            .map((item) => item.trim())
            .filter(Boolean)
        : [];

    const useWebIngredients =
      offIngredients.length === 0 && webEnrichment?.safe_to_use_ingredients;

    const ingredients = useWebIngredients
      ? webEnrichment.ingredients
      : offIngredients;

    const offNutrition = offValidation.nutrition;
    const useWebNutrition =
      (offValidation.status === "needs_verification" ||
        nutritionCount(offNutrition) < 3) &&
      webEnrichment?.safe_to_use_nutrition &&
      webEnrichment?.nutrition_per_100g;

    const effectiveNutrition = useWebNutrition
      ? {
          serving_size: "per 100 g",
          label_basis: "per_100g",
          servings_per_container: null,
          ...webEnrichment.nutrition_per_100g,
        }
      : offNutrition;

    const effectiveQuantity =
      !isUnknown(product.quantity)
        ? product.quantity
        : webEnrichment?.pack_size_verified
        ? webEnrichment.pack_size
        : "Unknown";

    const effectiveProduct = {
      ...product,
      quantity: effectiveQuantity,
      ingredients: ingredients.length ? ingredients.join(", ") : "Unknown",
      nutrients_per_100g: useWebNutrition
        ? nutritionToProductShape(webEnrichment.nutrition_per_100g)
        : nutritionToProductShape(offNutrition),
      data_provenance: {
        ingredients: useWebIngredients
          ? "web_verified"
          : offIngredients.length
          ? "open_food_facts"
          : "unavailable",
        nutrition: useWebNutrition
          ? "web_verified"
          : offValidation.status === "verified" && nutritionCount(offNutrition) >= 3
          ? "open_food_facts"
          : "unavailable",
        quantity: !isUnknown(product.quantity)
          ? "open_food_facts"
          : webEnrichment?.pack_size_verified
          ? "web_verified"
          : "unavailable",
      },
    };

    const data = await analyzeWithGroq(apiKey, effectiveProduct, profile);

    const ingredientSource = useWebIngredients
      ? "web_verified"
      : offIngredients.length
      ? "open_food_facts"
      : "unavailable";

    const nutritionSource = useWebNutrition
      ? "web_verified"
      : offValidation.status === "verified" && nutritionCount(offNutrition) >= 3
      ? "open_food_facts"
      : "unavailable";

    const quantitySource = !isUnknown(product.quantity)
      ? "open_food_facts"
      : webEnrichment?.pack_size_verified
      ? "web_verified"
      : "unavailable";

    return res.status(200).json({
      success: true,
      data: {
        ...data,
        product_category:
          product.categories ||
          product.pnns_groups_2 ||
          product.pnns_groups_1 ||
          "Unknown",
        product_quantity:
          effectiveQuantity === "Unknown" ? null : effectiveQuantity,
        pack_size_verified:
          quantitySource === "web_verified" ||
          quantitySource === "open_food_facts",
        ingredients,
        ingredients_source: ingredientSource,
        nutrition: effectiveNutrition,
        nutrition_source: nutritionSource,
        nutrition_validation: {
          status:
            nutritionSource === "unavailable"
              ? "needs_verification"
              : "verified",
          message:
            nutritionSource === "web_verified"
              ? "Nutrition was recovered from a high-confidence exact-product web match after the barcode data failed validation."
              : nutritionSource === "open_food_facts" && offValidation.corrected_fields.length
              ? "Open Food Facts data passed sanity checks after safe corrections derived from its own fields."
              : nutritionSource === "open_food_facts"
              ? "Open Food Facts nutrition passed consistency checks."
              : offValidation.issues.length
              ? `Open Food Facts data failed validation: ${offValidation.issues.join("; ")}. Scan the package label to verify.`
              : "Nutrition could not be verified from the barcode database or web fallback.",
          basis: "per_100g",
          issues: offValidation.issues,
          corrected_fields: offValidation.corrected_fields,
        },
        nutriscore_grade: product.nutriscore_grade || null,
        nutriscore_score:
          product.nutriscore_score != null
            ? Number(product.nutriscore_score)
            : null,
        rating:
          nutritionSource === "unavailable"
            ? null
            : cleanRating(data.rating),
        rating_verified: nutritionSource !== "unavailable",
        data_sources: {
          ingredients: ingredientSource,
          nutrition: nutritionSource,
          quantity: quantitySource,
          web: webEnrichment
            ? {
                confidence: webEnrichment.confidence,
                match_score: webEnrichment.match_score,
                source_type: webEnrichment.source_type,
                source_name: webEnrichment.source_name,
                source_url: webEnrichment.source_url,
                evidence_summary: webEnrichment.evidence_summary,
              }
            : null,
        },
        verification_required:
          ingredientSource === "unavailable" ||
          nutritionSource === "unavailable" ||
          quantitySource === "unavailable" ||
          offValidation.status === "needs_verification",
      },
    });
  } catch (error) {
    console.error("Barcode Groq analysis failed:", error);

    return res.status(500).json({
      success: false,
      message:
        error?.message ||
        "Unable to analyze the scanned product right now.",
    });
  }
}
