export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { imageData } = req.body;

  if (!imageData) {
    return res.status(400).json({ error: "Image extracted text is required" });
  }

  try {
    // Clean and format the ingredient list
    console.log("Extracted Text for Analysis:", imageData);
    const formattedIngredients = imageData
      .replace(/\n|\r|\|/g, " ")
      .replace(/Ingredients:/i, "")
      .trim();

    // Call OpenFoodFacts API to analyze ingredients
    const response = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
        formattedIngredients
      )}&json=true`
    );

    const data = await response.json();

    if (data.products && data.products.length > 0) {
      const product = data.products[0];
      const productInfo = {
        product_name: product.product_name || "Unknown Product",
        ingredients_text:
          product.ingredients_text || "No ingredient list available",
        health_rating: product.nutriscore_grade || "No rating available",
        harmful_ingredients:
          product.ingredients_analysis_tags?.filter(
            (tag) => tag.includes("palm") || tag.includes("additive")
          ) || [],
        additives: product.additives_tags || [],
        nutri_score: product.nutriscore_grade || "No Nutri-Score available",
        product_category: product.categories_tags?.[0] || "Unknown Category",
        barcode: product.code || "No barcode available",
        packaging: product.packaging || "No packaging info available",
        allergens: product.allergens || "No allergen info available",
      };

      return res.status(200).json({ success: true, product: productInfo });
    } else {
      return res
        .status(404)
        .json({ success: false, message: "No product found" });
    }
  } catch (error) {
    console.error("Error analyzing ingredients:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
