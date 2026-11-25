import test from "node:test";
import assert from "node:assert/strict";
import { allergyList, dietParts, profileWarnings } from "../lib/dietaryProfile.mjs";

test("imports old free text, preserves additional preferences and custom allergies", () => {
  assert.deepEqual(dietParts("non veg, gluten-free"), {diet:"Non-vegetarian", other:"gluten-free"});
  assert.deepEqual(allergyList("peanut; Peanuts, dairy, kiwi"), ["Peanuts", "Milk", "kiwi"]);
});
test("veg, non-veg and vegan choices have distinct effects", () => {
  const warnings = (diet, food) => profileWarnings({dietaryPreferences:diet}, {ingredients:[food]}).dietaryWarnings;
  assert.deepEqual(warnings("Non-vegetarian","chicken"), []);
  assert.equal(warnings("Veg","egg").length,1);
  assert.deepEqual(warnings("Vegetarian","milk solids"), []);
  assert.equal(warnings("Vegan","milk solids").length,1);
  assert.deepEqual(warnings("Vegan","cocoa butter, oat milk"), []);
});
test("matches chosen allergies across ingredients, declarations and possible traces", () => {
  const profile = { dietaryPreferences:"Non-vegetarian", allergies:"Peanuts, Tree nuts, Soy, Milk, kiwi, sesame" };
  const food = {ingredients:["cocoa butter","kiwi","soya lecithin"],allergens:"may contain almonds",traces:"en:peanuts"};
  assert.deepEqual(profileWarnings(profile,food).allergyWarnings,["Peanuts","Tree nuts","Soy","kiwi"]);
  assert.deepEqual(profileWarnings({ allergies:"egg, constructor" }, {ingredients:["eggplant"]}).allergyWarnings,[]);
  assert.deepEqual(profileWarnings({ allergies:"Milk" }, {ingredients:["coconut milk","whey"]}).allergyWarnings,["Milk"]);
});
