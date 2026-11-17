import test from "node:test";
import assert from "node:assert/strict";
import { formatNutritionValue, nutritionBasisLabel, usableProductImage } from "../lib/nutritionDisplay.mjs";

test("long decimal nutrient values are compact on mobile", () => {
  assert.equal(formatNutritionValue(50.7142857142857, "g"), "50.7");
  assert.equal(formatNutritionValue(6.66666666666666, "g"), "6.7");
  assert.equal(formatNutritionValue(78.5714285714, "mg"), "78.6");
  assert.equal(formatNutritionValue(517.845761316, "kcal"), "518");
  assert.equal(formatNutritionValue(0.03, "g"), "0.03");
  assert.equal(formatNutritionValue(null), "—");
  assert.equal(formatNutritionValue("Unknown"), "—");
});

test("quick view shows the actual basis instead of the pack serving", () => {
  assert.equal(nutritionBasisLabel({ label_basis: "per_100g", serving_size: "4 fingers (42 g)" }), "Per 100 g");
  assert.equal(nutritionBasisLabel({ label_basis: "per_100ml" }), "Per 100 ml");
  assert.equal(nutritionBasisLabel({ label_basis: "per_serving", serving_size: "42 g" }), "Per serving (42 g)");
});

test("placeholder image URLs are not treated as photos", () => {
  assert.equal(usableProductImage("Unknown"), "");
  assert.equal(usableProductImage(""), "");
  assert.equal(usableProductImage("https://images.openfoodfacts.org/test.jpg"), "https://images.openfoodfacts.org/test.jpg");
});
