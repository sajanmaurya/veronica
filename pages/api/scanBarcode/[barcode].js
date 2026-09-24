// export default async function handler(req, res) {
//   const { barcode } = req.query;

//   if (!barcode) {
//     return res.status(400).json({ error: "Barcode is required" });
//   }

//   try {
//     const response = await fetch(
//       `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`
//     );

//     if (!response.ok) {
//       const errorText = await response.text();
//       console.error("API Error Response:", errorText);
//       throw new Error(
//         `Failed to fetch data from OpenFoodFacts: ${response.statusText}`
//       );
//     }

//     const data = await response.json();

//     if (data.status === 1 && data.product) {
//       res.status(200).json({ success: true, data });
//       console.log(data, "product data from openfoodfacts");
//     } else {
//       res.status(404).json({ success: false, error: "Product not found" });
//     }
//   } catch (error) {
//     console.error("Error fetching product details:", error);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// }

const cleanFoodData = (product) => ({
  barcode: product.code || "Unknown",
  product_name: product.product_name || product.product_name_en || "Unknown",
  brand: product.brands || "Unknown",
  categories: product.categories_tags
    ? product.categories_tags.join(", ")
    : "Unknown",
  countries: product.countries_tags
    ? product.countries_tags.join(", ")
    : "Unknown",
  image_front_url: product.image_front_url || "Unknown",
  image_nutrition_url: product.image_nutrition_url || "Unknown",
  quantity: product.quantity || "Unknown",
  product_type: product.product_type || "food",
  serving_size: product.serving_size || "Unknown",
  serving_quantity: product.serving_quantity || "Unknown",
  serving_quantity_unit: product.serving_quantity_unit || "Unknown",

  nutrients_per_100g: Object.fromEntries(
    Object.entries(product.nutriments || {})
      .filter(([key]) => key.endsWith("_100g"))
      .map(([key, value]) => [key.replace("_100g", ""), value])
  ),

  nutrient_levels: product.nutrient_levels || "Unknown",
  nutriscore_grade:
    product.nutriscore_grade || product.nutriscore_2023_tags?.[0] || "Unknown",
  nutriscore_score:
    product.nutriscore_score || product.nutrition_score_fr || "Unknown",
  nutriscore_version: product.nutriscore_version || "2023",
  ecoscore_grade: product.ecoscore_grade || "Unknown",
  ecoscore_version: product.ecoscore_version || "2023",

  pnns_groups_1: product.pnns_groups_1 || "Unknown",
  pnns_groups_2: product.pnns_groups_2 || "Unknown",
  ingredients:
    product.ingredients_text || product.ingredients_text_en || "Unknown",
  allergens:
    product.allergens_from_ingredients || product.allergens || "Unknown",
  traces: product.traces || "Unknown",
  nova_group: product.nova_groups_tags
    ? product.nova_groups_tags[0]
    : "Unknown",
  popularity_key: product.popularity_key || "Unknown",

  packaging: product.packagings
    ? product.packagings.map((p) => p.material).join(", ")
    : "Unknown",
  data_quality_warnings: product.data_quality_warnings_tags
    ? product.data_quality_warnings_tags.join(", ")
    : "Unknown",

  rating: "To be calculated by AI",
});

export default async function handler(req, res) {
  const { barcode } = req.query;

  if (!barcode) {
    return res.status(400).json({ error: "Barcode is required" });
  }

  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API Error Response:", errorText);
      throw new Error(
        `Failed to fetch data from OpenFoodFacts: ${response.statusText}`
      );
    }

    const data = await response.json();

    if (data.status === 1 && data.product) {
      const cleanedData = cleanFoodData(data.product);
      console.log("Cleaned API Response:", JSON.stringify(cleanedData));
      res.status(200).json({ success: true, data: cleanedData });
    } else {
      res.status(404).json({ success: false, error: "Product not found" });
    }
  } catch (error) {
    console.error("Error fetching product details:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
