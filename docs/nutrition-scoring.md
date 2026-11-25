# Veronica nutrition scoring — release 0.4.0

Runnable, dependency-free JavaScript ES module. No AI calls or network requests.
This is a review implementation of published Nutri-Score 2023 numerical rules,
not a newly validated scientific method or an official certification.

## Run

Requires Node.js 18 or later:

```sh
node --test nutritionScoring.test.mjs
node example.mjs
```

## Files

- nutritionScoring.mjs: scoring tables, input checks, normalization, category
  branches, point breakdown, missing-data interval and grades.
- nutritionScoring.test.mjs: table boundary and behavioral regression tests.
- example.mjs: the supplied chocolate label, without guessing missing fibre.

## Input contract

`calculateNutritionScore(product)` takes:

```js
{
  eligibility: 'eligible', // 'ineligible' or unknown also accepted
  category: 'general',
  basis: 'per_100g',
  // for per_serving only: serving: {quantity: 20, unit: 'g'},
  // beverage category requires a verified true/false:
  // hasSpecifiedSweeteners: false,
  nutrients: {
    energyKj: null, energyKcal: 543,
    sugarsG: 55.3, saturatedFatG: 21.5, totalFatG: 31.4,
    saltG: null, sodiumMg: 125,
    fibreG: null, proteinG: 7.6, carbohydratesG: 58.5,
    eligiblePlantPercent: null
  }
}
```

Only finite nonnegative numbers are accepted for numerical fields. Missing
fields and null mean unknown. Strings, booleans, NaN and Infinity are rejected.
All nutrient quantities refer to `basis`; eligiblePlantPercent is always a
percentage and is NOT scaled with serving size. Use total sugars, not added
sugars. Salt is grams; sodium is milligrams. If both are supplied they must
agree within documented rounding tolerance (0.01g or 2%). Energy tolerance is
5kJ or 2%. These consistency tolerances are Veronica engineering policy, not
Nutri-Score rules. Do not silently modify contradictory label information.

Categories: general, cheese, red_meat, fats_nuts_seeds, beverage, water.
Foods require per_100g and beverages/water per_100ml, or a compatible
per_serving quantity. No inferred density conversions. Fields describe the
appropriate as-sold/as-prepared state established upstream from official
product guidance. The scorer never guesses a preparation state.

IMPORTANT: This is the calculation engine, not an automatic category classifier.
The caller must establish eligibility and category using the official guidance.
Unknown eligibility/category returns insufficient_data. 'ineligible' returns
not_applicable. Do not send infant food, medical foods, sports nutrition,
meal replacements, alcohol or other out-of-scope products as 'general'.
Milk and milk-based drinks must follow the updated beverage classification,
not a simplistic all-dairy-is-cheese rule. Water must be a verified eligible
plain-water classification, not merely a drink with zero calories.

eligiblePlantPercent means qualifying ingredients according to the official
rules, with preparation/concentration adjustments already resolved upstream.
It is not every plant-derived ingredient; do not count sugar, cocoa or arbitrary
refined starches simply because they came from plants. Qualifying oils have
special treatment in the fats category. Do not infer percentages from order.
hasSpecifiedSweeteners refers to the list covered by the updated beverage
algorithm, not every ingredient colloquially called a sweetener. Require a
reviewed mapping upstream; unknown presence withholds the beverage score.

## Output

- scored: exact rawScore and grade, except the water exception has grade A
  with rawScore null because its grade is assigned directly.
- `grade_only` means all possible scores give the same confirmed letter.
- `insufficient_data` means the full grade is unresolved. If the category and
  units are valid and at least one measured scoring component applies, Veronica
  returns a separate `partialRating`. It sums the available penalty points,
  subtracts the available favourable points, and applies the category thresholds
  to that subtotal. For protein, it uses the penalty subtotal to decide eligibility.
  The partial result includes the components used and the possible final grade
  range. Missing nutrients stay null. An unrecognized category, an empty panel,
  or conflicting quantities cannot produce this rating.
- invalid_input: malformed numbers, wrong basis or contradictory values.
- not_applicable: explicit ineligibility.

Returns normalized values and individual point contributions. Null favourable
points remain unknown, even when the grade is invariant. Interval bounds allow
all theoretical favourable points; they are conservative, not estimates of
missing nutrient amounts. An interval can be wider than physically possible.
`scored` means calculation-complete, NOT independently verified label data.
Store source photographs, human corrections, date and extraction confidence
outside the scorer alongside its output. Never label these results 'medically
verified'. Personal allergy alerts and processing classifications are separate
systems, intentionally not arbitrary penalties in this nutrition calculation.

## Rules implemented

- All three numerical branches: general, fats/nuts/seeds and beverages.
- Cheese protein exception; red-meat protein cap of two.
- General protein exclusion at N >= 11; fats protein exclusion at N >= 7.
- Beverage specified-sweetener penalty of four.
- Category-specific A–E boundaries and water exception.
- Standard per-serving, kcal/kJ, sodium/salt normalization.
- Strict greater-than boundaries except inclusive fat-ratio thresholds.

## Validation and release limits

Automated tests cover the chocolate case, nutrient boundaries,
unit-equivalent inputs, protein exceptions, beverage and fat branches,
missing-data handling, bad inputs, deterministic input preservation and a
sugar-monotonicity sweep. Expected values were derived from the published tables.
These are implementation tests, NOT independent clinical validation or a
comparison against an official calculator fixture dataset. Before production,
perform that independent comparison, verify the upstream product eligibility,
classification, plant-content and sweetener mappings, and obtain expert review.
No clinical superiority over other apps is claimed.

## Source

French published specification implementing updated Nutri-Score, 14 March 2025:
https://www.legifrance.gouv.fr/loda/id/JORFTEXT000051329233/
Sections 1.1, 1.2 and 2 contain the numerical tables and branching rules.
Official resources and category guidance:
https://www.santepubliquefrance.fr/en/nutrition-and-physical-activity/nutri-score
Reviewed 17 November 2026. Version new rule changes rather than silently
changing existing saved results. Official logo use is separate from this code.

## Application integration

Both analysis APIs return `nutrition_score`; legacy `rating` is always null.
The UI shows the calculated A–E grade and points, never maps it to /10. Saved
legacy analyses are marked for rescanning, not silently converted. New analyses
retain the scoring version and complete breakdown in the existing JSON column.
No database migration is needed. Barcode results are recalculated server-side;
the local barcode cache namespace was bumped to prevent stale inputs.

`lib/scoringAdapter.mjs` conservatively routes recognized categories. Until
reviewed taxonomy and sweetener mappings are available, ambiguous categories,
plain fats/nuts/seeds, and beverages may return no grade. Unknown plant
percentages remain unknown; this can withhold grades for many products.
Missing sweetener status contributes an unknown 0–4 point penalty. A beverage
may still show `grade_only` E if the entire conservative score interval is E;
the exact score remains null and the missing field remains visible. If the
interval crosses a grade boundary, no grade is shown. Adapter tests cover both
cases, matching the numerical scorer's missing-data policy.
Image analysis still uses AI to transcribe label facts, including category text;
fixed code alone determines points and grade. Review the source label when
extracted facts appear wrong. Web-model recovered nutrition is excluded from
scoring. Barcode grades remain available without a Groq key or when the
optional explanation fails. Image transcription still requires Groq.

Run `npm test` at the project root. The integration tests additionally verify
response overrides, conservative category routing, serving conversion, and
an invocation of the real barcode API handler with no AI credentials.
