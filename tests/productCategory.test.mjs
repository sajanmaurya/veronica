import test from "node:test";
import assert from "node:assert/strict";
import {resolveCategory} from "../lib/productCategory.mjs";
const c=(categories,more={})=>resolveCategory({product_name:"Food product",categories,...more});
test("milk and plant milk drinks use updated beverage rules",()=>{for(const t of ["en:milk","en:chocolate-milks","en:plant-based-milks","en:drinkable-yogurts"])assert.equal(c(t).category,"beverage");});
test("soups, condensed milk, composite meals and milk chocolate use general rules",()=>{for(const t of ["en:soups","en:condensed-milks","en:milk-chocolates","en:pastas"])assert.equal(c(t).category,"general");});
test("fats and nuts use the dedicated category",()=>{for(const t of ["en:olive-oils","en:butters","en:almonds"])assert.equal(c(t).category,"fats_nuts_seeds");});
test("natural waters differ from flavoured water",()=>{assert.equal(c("en:mineral-waters").category,"water");assert.equal(c("en:mineral-waters,en:flavoured-waters").category,"beverage");});
test("composite meals override ingredient-category tags",()=>{assert.equal(c("en:cheeses,en:pizzas").category,"general");assert.equal(c("en:beef,en:tomato-sauces").category,"general");assert.equal(c("en:chocolates,en:olive-oils").category,"general");});
test("processed nuts require verified >50 percent contents",()=>{assert.deepEqual(c("en:peanut-butters"),{});assert.equal(c("en:peanut-butters",{nuts_seeds_percentage:51}).category,"fats_nuts_seeds");assert.equal(c("en:peanut-butters",{nuts_seeds_percentage:50}).category,"general");});
test("red meat mixes require verified at least 20 percent",()=>{assert.deepEqual(c("en:meatballs"),{});assert.equal(c("en:meatballs",{red_meat_percent:20}).category,"red_meat");assert.equal(c("en:meatballs",{red_meat_percent:19.9}).category,"general");});
test("unverified ingredient words do not select scoring category",()=>{assert.deepEqual(resolveCategory({product_name:"Olive oil"}),{});assert.deepEqual(resolveCategory({product_name:"Milk chocolate"}),{});assert.equal(c("en:chocolates",{product_name:"Milk chocolate"}).category,"general");});
test("excluded and preparation-dependent foods withheld",()=>{assert.equal(c("en:infant-formulas").eligibility,"ineligible");assert.equal(resolveCategory({product_name:"Baby cereal",categories:"en:cereals"}).eligibility,"ineligible");assert.deepEqual(c("en:drink-powders,en:beverages"),{});});

test("match complete category names while preserving beverage and eligibility rules", () => {
  assert.equal(c("Milk chocolate").category, "general");
  assert.equal(c("Chocolate milk").category, "beverage");
  assert.equal(c("en:Chocolate_Wafer").category, "general");
  assert.deepEqual(c("chocolate drink mix,beverages"), {});
  assert.deepEqual(c("unclassified chocolate mix"), {});
  assert.deepEqual(resolveCategory({ ingredients: ["chocolate"] }), {});
  assert.equal(c("chocolate,infant-formulas").eligibility, "ineligible");
});
