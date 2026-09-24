"use client"
import { Button } from '@mui/material';
import React, { useState } from 'react';
import { toast } from "react-toastify";
import { chatSession, getGeminiFallbackResponse, isModelUnavailableError, isQuotaError, normalizeGeminiJson } from '../../utils/GeminiAiModal';
import ProductSummery from '@/app/_components/ProductSummery';
import { useUserProfile } from "@/context/UserProfileContext";


const ImageUpload = () => {
    const [image , setImage] = useState(null);
    const [preview, setPreview] = useState(null);
    const [extractedText, setExtractedText] = useState("");
    const [loading , setLoding] = useState(false);
    const [aiData, setAiData] = useState(null);
    const { profile } = useUserProfile();

    const handleImageUpload = (event) => {
        const file = event.target.files[0];
        if(file){
            setImage(file);
            setPreview(URL.createObjectURL(file))
        }
    }


    const handleSubmit = async() => {
        if (!image) {
            toast.error("Please upload an image first!")
            return;
        }
        setLoding(true);
        console.log("Selected image:", image);
        const formData = new FormData();
        formData.append("image", image);

        // Since FormData cannot be easily logged directly, check the entries
        for (let pair of formData.entries()) {
            console.log(pair[0], pair[1]);
        }
        try {
            const response = await fetch("/api/uploadImage", {
              method: "POST",
              body: formData,
            });
      
            const data = await response.json();
            if (data.success) {
                setExtractedText(data.extractedText);
                console.log("extracted text :" , data.extractedText);
                if (!data.extractedText || !data.extractedText.trim()) {
                  toast.error("No readable text found in the image. Upload a clearer label image.");
                  return;
                }
                IngredientsCheck(data.extractedText);
            } else {
                toast.error(data.error || "Error extracting text!");
            }
            
           // console.log("Analysis Result:", data);
            // Show results to the user here

          } catch (error) {
            toast.error("Error analyzing image");
            console.error("Error analyzing image:", error);
          } finally {
            setLoding(false); 
          }
    }

    const IngredientsCheck = async(Text) => {
        try {
            if (!chatSession) {
                const fallback = getGeminiFallbackResponse("Gemini API key is missing. Add NEXT_PUBLIC_GEMINI_KEY to .env.local.");
                setAiData(fallback);
                toast.error("Gemini API key is missing. Add NEXT_PUBLIC_GEMINI_KEY to .env.local.");
                return;
            }

            // Extract and clean ingredients
            const extractedText = Text
                .replace(/\n|\r|\|/g, " ")  // Remove unwanted characters
                .replace(/Ingredients:/i, "") // Remove "Ingredients:" if present
                .trim();
    
            // Split into an array of individual ingredients
            const ingredientsList = extractedText.split(/\s*,\s*|\s*;\s*/); 
    
            console.log("Extracted Ingredients: ingredientsList", ingredientsList);

            const aiPrompt = `
            You are a professional nutritionist and food safety expert. Your task is to analyze the provided food product based on its nutritional content, ingredient list, and potential health effects.
            
            ### Instructions:
            You will be given JSON data for a food product. Perform the following tasks:
            
            1. **Health Rating (1–10)**  
               - **1–3**: Very Unhealthy – Contains high levels of harmful ingredients, added sugar, salt, saturated/trans fats, or artificial additives. Highly processed.  
               - **4–6**: Moderately Healthy – Contains some concerns; may be consumed in moderation.  
               - **7–10**: Healthy – Nutritionally balanced, low in harmful substances, suitable for regular consumption.
            
            2. **Harmful Ingredients Detection**  
               Identify any harmful or concerning components. Look for:  
               - **Added Sugar**: Over 10g per 100g  
               - **Saturated Fat**: Over 5g per 100g  
               - **Trans Fat**, **Artificial Preservatives**, or **Colorants**  
               - **Sodium**: Over 0.5g per 100g  
               - Known **allergens**, **toxic additives**, or **controversial ingredients**
            
               For each harmful ingredient, provide its name and a concise explanation of its health risks.
            
            3. **Overall Health Summary**  
               Summarize whether the product is safe for frequent, occasional, or rare consumption. Mention any notable positives or negatives. Suggest a healthier alternative if applicable.
            
            4. **User-Specific Summary (if applicable)**  
               If the user's health profile contains any diseases or allergies, provide a personalized summary evaluating the product's suitability for that user. Indicate whether the product is **safe, risky, or should be avoided**, and explain why. If there is no relevant health data, return an empty string.
            
            ---
            
            ### Product Data (JSON):
            ${ingredientsList.join(", ")}
            
            ### User Health Profile (optional):
            ${JSON.stringify({ diseases: profile.diseases || null, allergies: profile.allergies || null })}
            
            ---
            
            ### Required Output Format:
            Respond **ONLY** with a valid JSON object. Do **NOT** include any explanation or markdown. Follow this structure exactly:
            
            {
              "rating": number,
              "harmful_ingredients": [
                {
                  "name": "Ingredient Name",
                  "impact": "Explanation of health risks"
                }
              ],
              "summary": "Brief summary of health impact and usage recommendation",
              "user_specific_summary": "Personalized analysis based on user diseases or allergies (or empty string if not applicable)"
            }
            `;
            

            const result = await chatSession.sendMessage(aiPrompt);
    
            let aiText = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || "";

            console.log("AI Analysis Result:", aiText);

            const parsedAiData = normalizeGeminiJson(aiText) || getGeminiFallbackResponse("The AI response was empty or invalid. Please try again.");

            if (parsedAiData && typeof parsedAiData === "object") {
                setAiData(parsedAiData);
            }

        } catch (error) {
            console.error("Error analyzing ingredients:", error);

            if (isModelUnavailableError(error)) {
                const fallback = getGeminiFallbackResponse("The configured Gemini model is no longer available. Please update the app to a supported Google model.");
                setAiData(fallback);
                toast.warn("The connected Gemini model is no longer available. Please update the app configuration.");
                return;
            }

            if (isQuotaError(error)) {
                const fallback = getGeminiFallbackResponse();
                setAiData(fallback);
                toast.warn("AI analysis is temporarily unavailable because the Gemini API quota has been reached. Please try again later or update your billing plan.");
                return;
            }

            toast.error("Error analyzing ingredients");
            setAiData(getGeminiFallbackResponse("The product analysis could not be completed right now. Please try again in a few minutes."));
        }
    }
    return (
        <div className="flex flex-col items-center w-full mt-12 px-4">
          {/* Show upload section only if no AI summary yet */}
          {!aiData && (
            <div className="flex flex-col items-center w-full max-w-xl gap-6">
              {/* Image Preview */}
              {preview && (
                <img
                  src={preview}
                  alt="Uploaded"
                  className="h-64 object-cover rounded-lg shadow-lg mb-2"
                />
              )}
      
              {/* Upload / Capture */}
              <label className="w-full bg-gray-200 text-gray-600 h-20 py-4 px-6 rounded-lg text-lg font-medium hover:scale-105 hover:shadow-md transition-all flex items-center justify-center cursor-pointer">
                Upload / Capture Image
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </label>
      
              {/* Analyze Button */}
              <button
                onClick={handleSubmit}
                className="w-full bg-green-600 text-white text-lg py-3 rounded-lg hover:bg-green-700 transition-all disabled:opacity-50"
                disabled={loading}
              >
                {loading ? "Processing..." : "Analyze Ingredients"}
              </button>
            </div>
          )}
      
          {/* Product Summary */}
          {aiData && (
            <div className="w-full max-w-4xl mt-10">
              <ProductSummery aiData={aiData}  imageFrontUrl={preview}/>
            </div>
          )}
        </div>
      );
      
}

export default ImageUpload;