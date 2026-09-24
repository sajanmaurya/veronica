"use client"
import React, { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

const ProductSummary = ({ aiData, productName, imageFrontUrl, imageNutritionImage }) => {
    const { user } = useUser();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  const saveSearch = async () => {
    if (!user || !aiData) return;

    try {
      const res = await fetch("/api/previousSearches/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName,
          imageFrontUrl,
          imageNutritionImage,
          aiData,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to save search");
      }

      setSaved(true);
      setError(null);
      console.log("product saved in data base")
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
      saveSearch();
    }, [aiData]);

    return (
      aiData && (
        <div className="p-6 mt-6 mx-auto max-w-4xl">
             <h2 className="text-3xl font-bold text-gray-800 mb-2 text-center">Product Summary</h2>
          {/* Product Name */}
          {productName && (
            <h2 className="font-bold text-3xl text-gray-800 mb-4 text-center">
              Product Name - {productName}
            </h2>
          )}
  
          {/* Product Images */}
          {(imageFrontUrl || imageNutritionImage) && (
            <div className="flex justify-center gap-4 mb-6 flex-wrap">
              {imageFrontUrl && (
                <img
                  src={imageFrontUrl}
                  alt="Product Front"
                  className="w-48 h-48 object-contain"
                />
              )}
              {imageNutritionImage && (
                <img
                  src={imageNutritionImage}
                  alt="Nutrition Info"
                  className="w-48 h-48 object-contain"
                />
              )}
            </div>
          )}
  
          {/* Rating */}
          <p className="text-lg font-semibold text-blue-600 bg-blue-100 p-2 rounded-lg w-fit">
            <span className="text-gray-700">Rating:</span> {aiData.rating}/10
          </p>
  
          {/* Harmful Ingredients */}
          <div className="mt-4">
            <h4 className="text-red-600 text-xl font-semibold">Harmful Ingredients:</h4>
            {aiData.harmful_ingredients?.length > 0 ? (
              <ul className="list-disc list-inside mt-2 space-y-2">
                {aiData.harmful_ingredients.map((ingredient, index) => (
                  <li key={index} className="text-gray-700 bg-red-50 p-2 rounded-lg">
                    <strong className="text-red-500">{ingredient.name}:</strong> {ingredient.impact}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-green-600 bg-green-100 p-2 rounded-lg mt-2">
                No harmful ingredients detected.
              </p>
            )}
          </div>
  
          {/* General Summary */}
          <div className="mt-4">
            <h4 className="text-gray-800 text-xl font-semibold">Summary:</h4>
            <p className="text-gray-700 bg-gray-100 p-3 rounded-lg mt-2 leading-relaxed">
              {aiData.summary}
            </p>
          </div>
  
          {/* Personalized Summary */}
          {aiData.user_specific_summary && aiData.user_specific_summary.trim() !== "" && (
            <div className="mt-4">
              <h4 className="text-purple-700 text-xl font-semibold">Personalized Health Impact:</h4>
              <p className="text-gray-700 bg-purple-100 p-3 rounded-lg mt-2 leading-relaxed">
                {aiData.user_specific_summary}
              </p>
            </div>
          )}
           {error && (
            <p className="text-red-600 mt-2 font-semibold">Error: {error}</p>
          )}
        </div>
      )
    );
  };
  
  
  export default ProductSummary;
  