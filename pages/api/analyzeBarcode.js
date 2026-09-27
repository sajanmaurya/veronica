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
  },
  required: ["rating", "harmful_ingredients", "summary", "user_specific_summary"],
};

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

For user_specific_summary, use diseases and allergies only as context and avoid medical diagnosis. If the profile is empty, return an empty string.

PRODUCT DATA:
${JSON.stringify(product)}

USER PROFILE:
${JSON.stringify({
  diseases: profile?.diseases || "",
  allergies: profile?.allergies || "",
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
        ingredients,
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
