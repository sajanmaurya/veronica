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
    <main className="app-canvas"><div className="mx-auto flex w-full max-w-3xl flex-col items-center">

      {!aiData && (
        <div className="glass-panel flex w-full max-w-xl flex-col items-center gap-5 p-5 sm:p-8"><div className="w-full text-center"><p className="eyebrow">Visual analysis</p><h1 className="mt-4 text-3xl font-semibold tracking-[-.04em] text-slate-900">Read a food label</h1><p className="mt-2 text-sm leading-6 text-slate-600">Upload a clear photo of ingredients or nutrition facts.</p></div>

          {/* Image Preview */}
          {preview && (
            <img
              src={preview}
              alt="Uploaded"
              className="h-64 w-full rounded-2xl object-cover shadow-lg mb-1"
            />
          )}

          {/* Upload */}
          <label className="glass-surface w-full min-h-28 rounded-2xl px-6 py-6 text-center text-base font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:bg-white/80 flex items-center justify-center cursor-pointer">

            Upload or capture an image

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
            className="glass-button-primary w-full py-4 text-base disabled:pointer-events-none disabled:opacity-50"
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
    </main>
  );
};

export default ImageUpload;
