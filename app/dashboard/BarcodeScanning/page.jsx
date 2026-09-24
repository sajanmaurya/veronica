"use client";

import React, { useState } from "react";
import BarcodeScannerComponent from "react-qr-barcode-scanner";
import { toast } from "react-toastify";
import { chatSession, getGeminiFallbackResponse, isModelUnavailableError, isQuotaError, normalizeGeminiJson } from "../../utils/GeminiAiModal";
import ProductSummery from "@/app/_components/ProductSummery";
import { useUserProfile } from "@/context/UserProfileContext";

const BarcodeScanning = () => {
  const [scanning, setScanning] = useState(false);
  const [data, setData] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiData, setAiData] = useState(null);

  const { profile } = useUserProfile();

  const [imageFrontUrl, setImageFrontUrl] = useState("");
  const [imageNutritionImage, setImageNutritionImage] = useState("");
  const [productName, setProductName] = useState("");

  // =====================================================
  // BARCODE SCANNER
  // =====================================================

  const handleScan = (err, result) => {
    // No barcode detected is normal.
    // Do not show it as an application error.

    if (!result || !result.text) {
      return;
    }

    const barcode = String(result.text).trim();

    if (!barcode) {
      return;
    }

    console.log("Barcode Scanned:", barcode);

    // Stop scanner
    setScanning(false);

    // Store barcode
    setData(barcode);

    // Get product
    getResult(barcode);
  };

  // =====================================================
  // GET PRODUCT
  // =====================================================

  const getResult = async (barcode) => {
    if (!barcode || !String(barcode).trim()) {
      toast.error("Barcode is required");
      return;
    }

    try {
      setLoading(true);

      const cleanBarcode = String(barcode).trim();

      const result = await fetch(
        `/api/scanBarcode/${encodeURIComponent(cleanBarcode)}`
      );

      const response = await result.json();

      console.log("Barcode API Response:", response);

      if (!response.success || !response.data) {
        toast.error(response.message || "Product not found");
        return;
      }

      toast.success("Product Found");

      const product = response.data;

      // Product details
      const frontImage = product.image_front_url || "";
      const nutritionImage = product.image_nutrition_url || "";
      const name = product.product_name || "Unknown Product";

      setImageFrontUrl(frontImage);
      setImageNutritionImage(nutritionImage);
      setProductName(name);

      console.log(
        "Cleaned Product Data:",
        JSON.stringify(product)
      );

      // Send product to Gemini
      await analyzeProduct(
        JSON.stringify(product),
        name,
        frontImage,
        nutritionImage
      );

    } catch (error) {
      console.error("Error fetching product:", error);

      toast.error(
        "Something went wrong while fetching product"
      );
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // GEMINI AI ANALYSIS
  // =====================================================

  const analyzeProduct = async (
    productData,
    currentProductName,
    currentImageFrontUrl,
    currentImageNutritionImage
  ) => {
    try {
      setLoading(true);

      if (!chatSession) {
        const fallback = getGeminiFallbackResponse("Gemini API key is missing. Add NEXT_PUBLIC_GEMINI_KEY to .env.local.");
        setAiData(fallback);
        toast.error("Gemini API key is missing. Add NEXT_PUBLIC_GEMINI_KEY to .env.local.");
        return;
      }

      const InputPrompt = `
You are a highly experienced nutritionist and food safety analyst.

Evaluate the given food product based on its nutritional content, ingredients, and potential health impact.

IMPORTANT:
Give a practical food-safety and nutrition assessment.
Do not claim to diagnose or treat diseases.

### 1. HEALTH RATING

Give a health rating from 1 to 10.

- 1-3 = Very unhealthy
- 4-6 = Moderately healthy
- 7-10 = Healthy

Consider:

- Sugar
- Saturated fat
- Sodium/salt
- Protein
- Fiber
- Calories
- Ingredients
- Additives
- Processing level
- Overall nutritional quality

### 2. HARMFUL INGREDIENTS

Identify potentially concerning ingredients or nutritional values such as:

- Excess sugar above 10g per 100g
- Saturated fat above 5g per 100g
- High sodium
- Trans fats
- Artificial additives
- Preservatives
- Allergens
- Other concerning ingredients

For each one, explain its possible health impact.

If there are no significant harmful ingredients, return an empty array.

### 3. GENERAL SUMMARY

Give a concise summary.

Mention whether the product is best:

- Frequently consumed
- Occasionally consumed
- Better avoided

Suggest healthier alternatives when appropriate.

### 4. USER-SPECIFIC SUMMARY

Use the user's diseases and allergies if they are available.

Explain whether the product appears:

- Safe
- Risky
- Should be avoided

Do not make a medical diagnosis.

If no user-specific information is available, return an empty string.

### PRODUCT DATA

${productData}

### USER HEALTH PROFILE

${JSON.stringify({
  diseases: profile?.diseases || null,
  allergies: profile?.allergies || null,
})}

### RETURN ONLY VALID JSON

{
  "rating": 1,
  "harmful_ingredients": [
    {
      "name": "Ingredient Name",
      "impact": "Explanation of possible health concern"
    }
  ],
  "summary": "General analysis and recommendation",
  "user_specific_summary": "Personalized analysis based on diseases or allergies"
}

Do not return markdown.
Do not return \`\`\`json.
Return only the JSON object.
`;

      const result = await chatSession.sendMessage(InputPrompt);

      let aiText =
        result.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "";

      console.log("AI Raw Response:", aiText);

      const parsedAiData = normalizeGeminiJson(aiText) || getGeminiFallbackResponse("AI returned a blank or invalid response. Please try again.");

      console.log("Parsed AI Analysis:", parsedAiData);

      setAiData(parsedAiData);

      try {
        const saveResponse = await fetch(
          "/api/previousSearches/products",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              productName:
                currentProductName || "Unknown Product",

              imageFrontUrl:
                currentImageFrontUrl || null,

              imageNutritionImage:
                currentImageNutritionImage || null,

              aiData: parsedAiData,
            }),
          }
        );

        const saveData = await saveResponse.json();

        console.log(
          "Save Previous Search Response:",
          saveData
        );

        if (saveResponse.ok) {
          console.log(
            "Product search saved successfully."
          );
        } else if (saveResponse.status === 401) {
          console.warn(
            "User is not authenticated. Previous search was not saved."
          );
        } else {
          console.error(
            "Failed to save previous search:",
            saveData
          );
        }
      } catch (saveError) {
        console.error(
          "Error saving previous search:",
          saveError
        );
      }

      toast.success(
        "Product analysis completed!"
      );

    } catch (error) {
      console.error(
        "Error analyzing product:",
        error
      );

      if (isModelUnavailableError(error)) {
        const fallback = getGeminiFallbackResponse("The configured Gemini model is no longer available. Please update the app to a supported Google model.");
        setAiData(fallback);
        toast.warn(
          "The connected Gemini model is no longer available. Please update the app configuration."
        );
        return;
      }

      if (isQuotaError(error)) {
        const fallback = getGeminiFallbackResponse();
        setAiData(fallback);
        toast.warn(
          "AI product analysis is temporarily unavailable because the Gemini quota limit has been reached. Please try again later or update your billing plan."
        );
        return;
      }

      toast.error(
        "Something went wrong while analyzing the product."
      );
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // RESET
  // =====================================================

  const resetScan = () => {
    setScanning(false);
    setData("");
    setAiData(null);

    setProductName("");
    setImageFrontUrl("");
    setImageNutritionImage("");
  };

  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="flex flex-col items-center w-full mt-12 px-4">

      {/* =================================================
          SCANNER SECTION
      ================================================= */}

      {!aiData && (
        <div className="flex flex-col items-center w-full max-w-xl gap-6">

          {/* START / STOP BUTTON */}

          <button
            onClick={() =>
              setScanning(!scanning)
            }
            disabled={loading}
            className="w-full bg-gray-200 h-20 text-gray-600 py-4 px-6 rounded-lg text-lg font-medium hover:scale-105 hover:shadow-md transition-all disabled:opacity-50"
          >
            {scanning
              ? "Stop Scanning"
              : "Start Scanning Barcode"}
          </button>

          {/* BARCODE CAMERA */}

          {scanning && (
            <div className="flex justify-center w-full">

              <BarcodeScannerComponent
                onUpdate={handleScan}
                width={550}
                height={300}
              />

            </div>
          )}

          {/* MANUAL BARCODE INPUT */}

          <div className="w-full flex gap-2">

            <input
              type="text"
              value={data}
              onChange={(e) =>
                setData(e.target.value)
              }
              placeholder="Enter barcode manually"
              className="flex-1 border border-gray-300 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-green-500"
            />

            <button
              onClick={() =>
                getResult(data)
              }
              disabled={!data || loading}
              className="bg-green-600 text-white px-5 rounded-lg hover:bg-green-700 transition-all disabled:opacity-50"
            >
              {loading
                ? "Searching..."
                : "Search"}
            </button>

          </div>

          {/* SCANNED CODE */}

          {data && (
            <p className="text-gray-600 text-sm pt-2">

              Scanned Code:{" "}

              <span className="font-semibold">
                {data}
              </span>

            </p>
          )}

          {/* ANALYZE BUTTON */}

          <button
            onClick={() =>
              getResult(data)
            }
            disabled={!data || loading}
            className="w-full bg-green-600 text-white text-lg py-3 rounded-lg hover:bg-green-700 transition-all disabled:opacity-50"
          >
            {loading
              ? "Processing..."
              : "Analyze Ingredients"}
          </button>

        </div>
      )}

      {/* =================================================
          PRODUCT SUMMARY
      ================================================= */}

      {aiData && (
        <div className="w-full max-w-4xl mt-10">

          <ProductSummery
            aiData={aiData}
            productName={productName}
            imageFrontUrl={imageFrontUrl}
            imageNutritionImage={
              imageNutritionImage
            }
          />

          {/* SCAN ANOTHER */}

          <div className="flex justify-center mt-8">

            <button
              onClick={resetScan}
              className="bg-gray-700 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-all"
            >
              Scan Another Product
            </button>

          </div>

        </div>
      )}

    </div>
  );
};

export default BarcodeScanning;