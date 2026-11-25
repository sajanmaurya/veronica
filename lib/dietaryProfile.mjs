export const dietChoices = [
  ["Vegetarian", "Veg"], ["Non-vegetarian", "Non-veg"], ["Vegan", "Vegan"],
];

const allergens = {
  Milk: /\b(milk|buttermilk|whey|casein(?:ates?)?|lactose|ghee|paneer|cheese|yogurt|yoghurt|cream|butter)\b/i,
  Eggs: /\b(eggs?|albumen|albumin|ovalbumin)\b/i,
  Peanuts: /\b(peanuts?|groundnuts?)\b/i,
  "Tree nuts": /\b(tree[ -]nuts?|almonds?|cashews?|walnuts?|pecans?|pistachios?|hazelnuts?|macadamias?|brazil nuts?)\b/i,
  Wheat: /\b(wheat|maida|semolina|atta|durum|spelt)\b/i,
  Soy: /\b(soy|soya|soybeans?|tofu|tempeh)\b/i,
  Sesame: /\b(sesame|tahini)\b/i,
  Fish: /\b(fish|anchov(?:y|ies)|salmon|tuna|cod|sardines?)\b/i,
  Shellfish: /\b(shellfish|crustaceans?|shrimp|prawns?|crab|lobster|mussels?|oysters?)\b/i,
};
export const allergyChoices = Object.keys(allergens);
const aliases = { egg: "Eggs", peanut: "Peanuts", nuts: "Tree nuts", dairy: "Milk", soya: "Soy" };
export const profileItems = value => String(value ?? "").split(/[,;]+/).map(word => word.trim()).filter(Boolean);

export function allergyList(raw) {
  const items = profileItems(raw).map(item => {
    const lower = item.toLowerCase();
    return (Object.hasOwn(aliases, lower) ? aliases[lower] : null) || allergyChoices.find(choice => choice.toLowerCase() === lower) || item;
  });
  return [...new Map(items.map(item => [item.toLowerCase(), item])).values()];
}

export function dietParts(value) {
  const other = [];
  let diet = "";
  for (const item of profileItems(value)) {
    const key = item.toLowerCase().replace(/[\s-]/g, "");
    if (["veg", "vegetarian"].includes(key)) diet = "Vegetarian";
    else if (["nonveg", "nonvegetarian"].includes(key)) diet = "Non-vegetarian";
    else if (key === "vegan") diet = "Vegan";
    else other.push(item);
  }
  return { diet, other: other.join(", ") };
}

const animal = /\b(meat|chicken|beef|pork|mutton|lamb|poultry|turkey|lard|gela?tin(?:e)?)\b/i;
const gluten = /\b(gluten|wheat|barley|rye|malt|maida|semolina|atta)\b/i;
function milkText(text) {
  return text.replace(/\b(?:cocoa|shea|peanut|almond|cashew|sunflower(?: seed)?) butter\b|\b(?:coconut|oat|soya?|almond|rice|cashew) (?:milk|cream)\b|\bcream of tartar\b/gi, "");
}

export function profileWarnings(profile, product) {
  const { diet, other } = dietParts(profile?.dietaryPreferences);
  const ingredients = [].concat(product?.ingredients || []).join(", ").toLowerCase();
  const declared = [product?.allergens, product?.traces].flat().filter(Boolean).join(", ").toLowerCase();
  const text = [ingredients, declared].join(", ");
  const selected = allergyList(profile?.allergies);
  const allergyWarnings = selected.filter(item => {
    if (item === "Milk") return allergens.Milk.test(milkText(text));
    if (Object.hasOwn(allergens, item)) return allergens[item].test(text);
    if (item.toLowerCase() === "gluten") return gluten.test(text);
    const words = value => (value.match(/[\p{L}\p{N}]+/gu) || []).join(" ");
    const target = words(item.toLowerCase());
    return Boolean(target) && (" " + words(text) + " ").includes(" " + target + " ");
  });
  const dietaryWarnings = [];
  const animalIngredient = animal.test(ingredients) || allergens.Eggs.test(ingredients) ||
    allergens.Fish.test(ingredients) || allergens.Shellfish.test(ingredients);
  if (diet === "Vegetarian" && animalIngredient) dietaryWarnings.push("Possible non-vegetarian ingredient");
  if (diet === "Vegan" && (animalIngredient || allergens.Milk.test(milkText(ingredients)) || /\bhoney\b/i.test(ingredients)))
    dietaryWarnings.push("Possible non-vegan ingredient");
  if (/gluten[- ]?free/i.test(other) && gluten.test(text)) dietaryWarnings.push("Possible gluten ingredient");
  return { allergyWarnings, dietaryWarnings };
}
