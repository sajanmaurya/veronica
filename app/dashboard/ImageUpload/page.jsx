"use client";

import React, { useState } from "react";
import { toast } from "react-toastify";
import ProductSummery from "@/app/_components/ProductSummery";
import { useUserProfile } from "@/context/UserProfileContext";

const ImageUpload = () => {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiData, setAiData] = useState(null);

  const { profile } = useUserProfile();

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];

    if (file) {
      setImage(file);
      setPreview(URL.createObjectURL(file));
      setAiData(null);
    }
  };

  const handleSubmit = async () => {
    if (!image) {
      toast.error("Please upload an image first!");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();

      formData.append("image", image);

      formData.append(
        "profile",
        JSON.stringify({
          diseases: profile?.diseases || null,
          allergies: profile?.allergies || null,
        })
      );

      const response = await fetch("/api/analyzeImage", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Unable to analyze the image."
        );
      }

      setAiData(data.data);
    } catch (error) {
      console.error("Error analyzing image:", error);

      toast.error(
        error?.message ||
          "Error analyzing image. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center w-full mt-12 px-4">

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

          {/* Upload */}
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
            {loading
              ? "Analyzing image..."
              : "Analyze Ingredients"}
          </button>

        </div>
      )}

      {/* Result */}
      {aiData && (
        <div className="w-full max-w-4xl mt-10">
          <ProductSummery
            aiData={aiData}
            imageFrontUrl={preview}
          />
        </div>
      )}

    </div>
  );
};

export default ImageUpload;
