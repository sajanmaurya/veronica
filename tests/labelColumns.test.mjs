import test from "node:test";
import assert from "node:assert/strict";
import { analyzeLabelColumns, labelSchema } from "../lib/labelColumns.mjs";
import { validateBarcodeNutrition } from "../lib/nutritionValidation.js";

const chocolate = { product_category: "chocolates" };
const packet = (...columns) => ({ serving_size: "42 g", columns });
const standard = {
  heading: "Avg Qty per 100 g",
  energy_kj: "2160 kJ",
  protein_g: "6.6 g",
  total_fat_g: "26.5 g",
  saturated_fat_g: "14.8 g",
  carbohydrates_g: "61.7 g",
  total_sugar_g: "50.6 g",
  sodium_mg: "78 mg",
};
const serving = {
  heading: "Avg Qty per Serving",
  energy_kj: "910 kJ",
  protein_g: "2.8 g",
  total_fat_g: "11.1 g",
  saturated_fat_g: "6.2 g",
  carbohydrates_g: "25.9 g",
  total_sugar_g: "21.3 g",
  sodium_mg: "33 mg",
};
const percentage = { heading: "%DI* per Serving", total_sugar_g: "24%" };
const kitkat = packet(serving, percentage, standard);
const cadbury = {
  serving_size: "20 g",
  columns: [
    {
      heading: "Nutritional information (Per 100 g)",
      calories: "543 kcal",
      total_fat_g: "31.4 g",
      saturated_fat_g: "21.5 g",
      carbohydrates_g: "58.5 g",
      total_sugar_g: "55.3 g",
      added_sugar_g: "45.9 g",
      protein_g: "7.6 g",
      sodium_mg: "125 mg",
    },
  ],
};
const kaju = {
  serving_size: "50 g",
  columns: [
    {
      heading: "Per 100g",
      calories: "508.04 kcal",
      protein_g: "7.58 g",
      carbohydrates_g: "60.75 g",
      total_sugar_g: "20.08 g",
      added_sugar_g: "18.38 g",
      total_fat_g: "26.08 g",
      saturated_fat_g: "not more than 17.17 g",
      sodium_mg: "226.0 mg",
    },
    {
      heading: "Per Serving 50g",
      calories: "254.02 kcal",
      protein_g: "3.79 g",
      carbohydrates_g: "30.37 g",
      total_sugar_g: "10.04 g",
      added_sugar_g: "9.19 g",
      total_fat_g: "13.04 g",
      saturated_fat_g: "not more than 8.58 g",
      sodium_mg: "113 mg",
    },
  ],
};

// Endpoints evaluated independently with Open Food Facts ProductOpener::Nutriscore
// compute_nutriscore_score_and_grade_2023, source SHA-256 9fb7a4f5bc2450296f99040818fdfb2f7f13b81f64583ba71b1951ac40f6e65c.
// For each label, use fibre 0/8 g and eligible plants 0/100% to span their point
// ranges. For the biscuit also use saturates 0/17.17 g to span its printed upper limit.
for (const [name, product, panel, min, max, grade] of [
  ["KitKat 42 g", chocolate, kitkat, 20, 30, "E"],
  ["Milk chocolate 64 g", chocolate, cadbury, 22, 32, "E"],
  ["Butter Kaju biscuits 400 g", { product_category: "biscuits" }, kaju, 4, 24, null],
]) {
  test(name + " matches the independent reference endpoints", () => {
    const result = analyzeLabelColumns(product, panel);
    assert.equal(result.nutrition_validation.status, "extracted");
    assert.deepEqual(result.nutrition_score.scoreRange, { min, max });
    assert.equal(result.nutrition_score.grade, grade);
    assert.equal(result.nutrition_score.rawScore, null);
  });
}

test("preserves original columns and kJ, skips the daily-intake column, accepts label rounding", () => {
  const result = analyzeLabelColumns(chocolate, kitkat);
  assert.equal(result.nutrition.energy_kj, 2160);
  assert.equal(result.nutrition.calories, null);
  assert.equal(result.nutrition.total_sugar_g, 50.6);
  assert.equal(result.nutrition_score.normalized.energyKj, 2160);
  assert.deepEqual(result.nutrition_panel, kitkat);
  assert.equal(result.rating, null);
});

test("upper-limit values stay in the transcription and are unknown to the numerical scorer", () => {
  const result = analyzeLabelColumns({ product_category: "biscuits" }, kaju);
  assert.equal(result.nutrition.saturated_fat_g, null);
  assert.match(result.nutrition_panel.columns[0].saturated_fat_g, /not more than/);
});

const corruptPanels = {
  "per-serving sugar copied into per-100-g column": packet({ ...standard, total_sugar_g: "21.3 g" }, serving),
  "nutrient columns swapped under original headings": packet(
    { ...standard, heading: serving.heading },
    { ...serving, heading: standard.heading },
  ),
  "kJ placed in kcal slot": packet({ ...standard, energy_kj: null, calories: "2160 kJ" }),
  "2160 misread as kcal": packet({ ...standard, energy_kj: null, calories: "2160 kcal" }),
  "missing unit": packet({ ...standard, energy_kj: "2160" }),
  "two per-100-g columns": packet(standard, standard),
  "unreadable heading": packet({ ...standard, heading: "" }),
  "grams and ml used across columns": { ...kitkat, serving_size: "42 ml" },
  "serving size contradicts the printed heading": packet(standard, {
    ...serving,
    heading: "Per serving (21 g)",
  }),
  "no serving size for dual column": { ...kitkat, serving_size: null },
  "daily percentages only": packet(percentage),
  "no overlapping quantity": packet(
    { heading: standard.heading, energy_kj: "2160 kJ" },
    { heading: serving.heading, total_sugar_g: "21.3 g" },
  ),
  "conflicting energy units on same label": packet({ ...standard, calories: "315 kcal" }),
};
for (const [name, panel] of Object.entries(corruptPanels)) {
  test("scan-error replay withholds the grade for " + name, () => {
    const result = analyzeLabelColumns(chocolate, panel);
    assert.equal(result.nutrition_score.grade, null);
    assert.equal(result.nutrition_validation.status, "needs_verification");
    assert.equal(result.nutrition.energy_kj, null);
    assert.ok(result.nutrition_validation.message);
  });
}

test("a checked column can resolve a conflict without rewriting the scan", () => {
  const panel = corruptPanels["per-serving sugar copied into per-100-g column"];
  const review = { column_index: 0, column: standard, basis: "per_100g", serving_size: "42 g" };
  const result = analyzeLabelColumns(chocolate, panel, review);
  assert.equal(result.nutrition_validation.status, "user_checked");
  assert.equal(result.nutrition_score.grade, "E");
  assert.equal(result.nutrition_panel.columns[0].total_sugar_g, "21.3 g");
  assert.equal(result.nutrition.total_sugar_g, 50.6);
  assert.equal(
    analyzeLabelColumns(chocolate, panel, { ...review, column: { ...standard, energy_kj: "2160 kcal" } })
      .nutrition_score.grade,
    null,
  );
});

test("serving only is scaled once, and sodium may be printed in grams", () => {
  const result = analyzeLabelColumns(chocolate, packet({ ...serving, sodium_mg: "0.033 g" }));
  assert.equal(result.nutrition.sodium_mg, 33);
  assert.ok(Math.abs(result.nutrition_score.normalized.energyKj - (910 * 100) / 42) < 1e-8);
  assert.equal(result.nutrition_score.grade, "E");
});

test("preserves a real zero, solid/liquid bases, strict response schema", () => {
  const drink = { product_category: "beverages" };
  const result = analyzeLabelColumns(drink, {
    serving_size: "250 ml",
    columns: [
      { heading: "Per 100 ml", energy_kj: "0 kJ", total_sugar_g: "0 g" },
      { heading: "Per serving", energy_kj: "0 kJ", total_sugar_g: "0 g" },
    ],
  });
  assert.equal(result.nutrition.energy_kj, 0);
  assert.equal(result.nutrition.label_basis, "per_100ml");
  const schema = labelSchema.properties.columns.items;
  assert.deepEqual(schema.required.sort(), Object.keys(schema.properties).sort());
});

test("barcode kJ is kept at original precision, including zero", () => {
  for (const kj of [0, 2160, 2010.01]) {
    assert.equal(
      validateBarcodeNutrition({ nutrients_per_100g: { "energy-kj": kj } }).nutrition.energy_kj,
      kj,
    );
  }
});

test("the photo API turns the model transcription into a deterministic grade", async () => {
  const { readFile } = await import("node:fs/promises");
  const { Readable } = await import("node:stream");
  const source = (await readFile(new URL("../pages/api/analyzeImage.js", import.meta.url), "utf8"))
    .replace(
      '"@/lib/labelColumns.mjs"',
      JSON.stringify(new URL("../lib/labelColumns.mjs", import.meta.url).href),
    )
    .replace('"formidable"', JSON.stringify(import.meta.resolve("formidable")));
  const { default: handler } = await import(
    "data:text/javascript;base64," + Buffer.from(source).toString("base64")
  );
  const oldKey = process.env.GROQ_API_KEY;
  const originalFetch = globalThis.fetch;
  try {
    process.env.GROQ_API_KEY = "fixture";
    globalThis.fetch = async (_url, options) => {
      const request = JSON.parse(options.body);
      assert.deepEqual(request.response_format.json_schema.schema.properties.nutrition, labelSchema);
      const transcription = {
        ...chocolate,
        is_food_product: true,
        nutrition: kitkat,
        ingredients: [],
        rating: 10,
      };
      return Response.json({ choices: [{ message: { content: JSON.stringify(transcription) } }] });
    };
    const form = new FormData();
    form.append(
      "image",
      new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" }),
      "example.png",
    );
    const http = new Request("http://localhost/api/analyzeImage", { method: "POST", body: form });
    const bytes = Buffer.from(await http.arrayBuffer());
    const req = Object.assign(Readable.from([bytes]), {
      method: "POST",
      headers: { "content-type": http.headers.get("content-type"), "content-length": String(bytes.length) },
    });
    const res = {
      status(code) {
        this.code = code;
        return this;
      },
      json(body) {
        this.body = body;
      },
    };
    await handler(req, res);
    assert.equal(res.code, 200);
    assert.equal(res.body.data.rating, null);
    assert.equal(res.body.data.nutrition_score.grade, "E");
    assert.equal(res.body.data.nutrition.energy_kj, 2160);
    assert.equal(res.body.data.nutrition_panel.columns.length, 3);
  } finally {
    globalThis.fetch = originalFetch;
    if (oldKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = oldKey;
  }
});

test("barcode rejects contradictory kJ and kcal before issuing a grade", () => {
  const result = validateBarcodeNutrition({
    nutrients_per_100g: {
      "energy-kj": 2160,
      "energy-kcal": 300,
      sugars: 50.6,
      proteins: 6.6,
    },
  });
  assert.equal(result.status, "needs_verification");
  assert.ok(result.invalid_fields.includes("energy_kj"));
});
