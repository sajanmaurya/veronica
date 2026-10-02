const BROWSER_MODEL = "openai/gpt-oss-20b";
const STRUCTURED_MODEL = "qwen/qwen3.8-27b";

function isUnknown(value) {
  const text = String(value ?? "").trim().toLowerCase();
  return !text || text === "unknown" || text === "n/a" || text === "null";
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function countNutritionValues(source) {
  if (!source || typeof source !== "object") return 0;

  const keys = [
    "energy-kcal",
    "energy_kcal",
    "fat",
    "saturated-fat",
    "saturated_fat",
    "carbohydrates",
    "fiber",
    "sugars",
    "sugar",
    "proteins",
    "protein",
    "sodium",
  ];

  return keys.reduce(
    (count, key) => count + (finite(source[key]) != null ? 1 : 0),
    0
  );
}

export function needsWebEnrichment(product) {
  const missingIngredients = isUnknown(product?.ingredients);
  const missingNutrition = countNutritionValues(product?.nutrients_per_100g) < 3;
  const missingQuantity = isUnknown(product?.quantity);

  return {
    required: missingIngredients || missingNutrition || missingQuantity,
    missingIngredients,
    missingNutrition,
    missingQuantity,
  };
}

const enrichmentSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    exact_gtin_match: { type: "boolean" },
    brand_match: { type: "boolean" },
    product_name_match: { type: "boolean" },
    pack_size_match: { type: "boolean" },
    source_type: {
      type: "string",
      enum: ["manufacturer", "gs1", "retailer", "database", "other", "unknown"],
    },
    source_name: { type: ["string", "null"] },
    source_url: { type: ["string", "null"] },
    pack_size: { type: ["string", "null"] },
    ingredients: {
      type: "array",
      items: { type: "string" },
    },
    nutrition_basis: {
      type: "string",
      enum: ["per_100g", "per_serving", "unknown"],
    },
    serving_size_g: { type: ["number", "null"] },
    nutrition: {
      type: "object",
      additionalProperties: false,
      properties: {
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
        "calories",
        "total_fat_g",
        "saturated_fat_g",
        "trans_fat_g",
        "carbohydrates_g",
        "fiber_g",
        "total_sugar_g",
        "added_sugar_g",
        "protein_g",
        "sodium_mg"
      ],
    },
    evidence_summary: { type: "string" },
  },
  required: [
    "exact_gtin_match",
    "brand_match",
    "product_name_match",
    "pack_size_match",
    "source_type",
    "source_name",
    "source_url",
    "pack_size",
    "ingredients",
    "nutrition_basis",
    "serving_size_g",
    "nutrition",
    "evidence_summary"
  ],
};

function confidenceFromIdentity(data) {
  let score = 0;

  if (data?.exact_gtin_match) score += 60;
  if (data?.brand_match) score += 15;
  if (data?.product_name_match) score += 10;
  if (data?.pack_size_match) score += 10;
  if (["manufacturer", "gs1"].includes(data?.source_type)) score += 5;

  if (score >= 80) return { score, level: "high" };
  if (score >= 60) return { score, level: "medium" };
  return { score, level: "low" };
}

function normalizeWebNutrition(data) {
  const nutrition = data?.nutrition || {};
  const basis = data?.nutrition_basis || "unknown";
  const servingSizeG = finite(data?.serving_size_g);

  const fields = {
    calories: finite(nutrition.calories),
    total_fat_g: finite(nutrition.total_fat_g),
    saturated_fat_g: finite(nutrition.saturated_fat_g),
    trans_fat_g: finite(nutrition.trans_fat_g),
    carbohydrates_g: finite(nutrition.carbohydrates_g),
    fiber_g: finite(nutrition.fiber_g),
    total_sugar_g: finite(nutrition.total_sugar_g),
    added_sugar_g: finite(nutrition.added_sugar_g),
    protein_g: finite(nutrition.protein_g),
    sodium_mg: finite(nutrition.sodium_mg),
  };

  if (basis === "per_100g") {
    return fields;
  }

  if (basis === "per_serving" && servingSizeG && servingSizeG > 0) {
    const factor = 100 / servingSizeG;
    return Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [
        key,
        value == null ? null : Math.round(value * factor * 100) / 100,
      ])
    );
  }

  return null;
}

async function callGroq(apiKey, body) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const raw = await response.text();

  if (!response.ok) {
    let message = raw;

    try {
      message = JSON.parse(raw)?.error?.message || raw;
    } catch {}

    throw new Error(message || `Groq request failed with HTTP ${response.status}`);
  }

  return JSON.parse(raw);
}

export async function enrichProductFromWeb(product, apiKey) {
  const barcode = String(product?.barcode || "").trim();
  const productName = String(product?.product_name || "").trim();
  const brand = String(product?.brand || "").trim();
  const quantity = isUnknown(product?.quantity) ? "" : String(product.quantity).trim();
  const category = String(product?.categories || "").trim();

  if (!barcode || barcode.toLowerCase() === "unknown") {
    return null;
  }

  const researchPrompt = `
You are researching one exact packaged-food SKU for Veronica.

TARGET PRODUCT
GTIN/barcode: ${barcode}
Brand: ${brand || "unknown"}
Product name: ${productName || "unknown"}
Known pack size: ${quantity || "unknown"}
Category: ${category || "unknown"}

Search the live web for this exact product.

SOURCE PRIORITY:
1. Manufacturer / brand website
2. GS1 / Verified by GS1 identity information
3. Product database with the exact GTIN
4. Retailer page only when the exact GTIN or an unambiguous exact SKU match is visible

RULES:
- Search the exact GTIN in quotes first.
- Do not merge facts from a different pack size, flavor, country version, or similar product.
- Explicitly state whether the exact GTIN appears in the source.
- Capture net pack size only when the source explicitly states it.
- Capture ingredients only when explicitly listed by the source.
- Capture nutrition only when explicitly stated.
- Prefer per-100-g nutrition. If only per-serving data exists, include the serving size in grams exactly.
- Include the best source name and direct URL.
- If exact identity cannot be established, say so and do not guess.
- Never infer nutrition or ingredients from general knowledge.

Return a concise evidence report with the facts, exact-match status, and source URL.
`;

  const browserPayload = await callGroq(apiKey, {
    model: BROWSER_MODEL,
    temperature: 0.1,
    reasoning_effort: "low",
    max_completion_tokens: 3000,
    tool_choice: "required",
    tools: [{ type: "browser_search" }],
    messages: [
      {
        role: "system",
        content:
          "Research exact retail SKUs conservatively. Never substitute a similar product.",
      },
      { role: "user", content: researchPrompt },
    ],
  });

  const researchText =
    browserPayload?.choices?.[0]?.message?.content || "";

  if (!researchText.trim()) {
    return null;
  }

  const parserPrompt = `
Extract only facts explicitly supported by the research evidence below.

TARGET
GTIN: ${barcode}
Brand: ${brand || "unknown"}
Product: ${productName || "unknown"}
Known pack size: ${quantity || "unknown"}

STRICT EXTRACTION RULES:
- exact_gtin_match may be true only if the evidence explicitly says the exact GTIN/barcode ${barcode} appears on the matched source.
- brand_match and product_name_match may be true only when explicitly supported.
- pack_size_match may be true only when both the target pack size and source pack size are known and match.
- source_url must be a URL explicitly present in the evidence; otherwise null.
- Never invent ingredients or nutrient values.
- For sodium, output milligrams.
- If nutrition is per serving, keep nutrition_basis as per_serving and provide serving_size_g only when explicit.
- If the evidence is ambiguous or for another size/flavor, return empty ingredients and null nutrition values.

RESEARCH EVIDENCE:
${researchText}
`;

  const parsedPayload = await callGroq(apiKey, {
    model: STRUCTURED_MODEL,
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "Return only the requested JSON object. Use only explicit evidence from the supplied research text.",
      },
      { role: "user", content: parserPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "product_web_enrichment",
        strict: true,
        schema: enrichmentSchema,
      },
    },
  });

  const content = parsedPayload?.choices?.[0]?.message?.content;

  if (!content) {
    return null;
  }

  const parsed = JSON.parse(content);
  const confidence = confidenceFromIdentity(parsed);
  const nutritionPer100g = normalizeWebNutrition(parsed);
  const nutrientCount = nutritionPer100g
    ? Object.values(nutritionPer100g).filter((value) => value != null).length
    : 0;

  const packSizeVerified =
    Boolean(parsed.pack_size) &&
    (parsed.exact_gtin_match ||
      (parsed.source_type === "manufacturer" &&
        parsed.brand_match &&
        parsed.product_name_match));

  return {
    ...parsed,
    confidence: confidence.level,
    match_score: confidence.score,
    nutrition_per_100g: nutritionPer100g,
    safe_to_use_nutrition: confidence.level === "high" && nutrientCount >= 3,
    safe_to_use_ingredients:
      confidence.level === "high" &&
      Array.isArray(parsed.ingredients) &&
      parsed.ingredients.length > 0,
    pack_size_verified: packSizeVerified,
    research_excerpt: researchText.slice(0, 3000),
  };
}
