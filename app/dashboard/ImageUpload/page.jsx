"use client";

import React, { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import ProductSummery from "@/app/_components/ProductSummery";
import { useUserProfile } from "@/context/UserProfileContext";

const ImageUpload = () => {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiData, setAiData] = useState(null);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const { profile } = useUserProfile();

  useEffect(() => {
    return () => {
      if (preview?.startsWith("blob:")) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const setSelectedImage = (file) => {
    if (!file) return;

    if (preview?.startsWith("blob:")) {
      URL.revokeObjectURL(preview);
    }

    setImage(file);
    setPreview(URL.createObjectURL(file));
    setAiData(null);
  };

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];
    setSelectedImage(file);

    // Allow selecting/capturing the same file again later.
    event.target.value = "";
  };

  const handleSubmit = async () => {
    if (!image) {
      toast.error("Please take or upload a photo first.");
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
          dietaryPreferences: profile?.dietaryPreferences || null,
        })
      );

      const response = await fetch("/api/analyzeImage", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to analyze the image.");
      }

      setAiData(data.data);
    } catch (error) {
      console.error("Error analyzing image:", error);
      toast.error(
        error?.message || "Error analyzing image. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const clearImage = () => {
    if (preview?.startsWith("blob:")) {
      URL.revokeObjectURL(preview);
    }

    setImage(null);
    setPreview(null);
    setAiData(null);
  };

  return (
    <main className="app-canvas">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center">
        {!aiData && (
          <div className="glass-panel flex w-full max-w-xl flex-col items-center gap-4 p-4 sm:p-7">
            {!image ? (
              <>
                <div className="w-full text-center">
                  <p className="text-xl font-semibold tracking-[-.03em] text-slate-950">
                    Scan the food label
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Use your phone camera for the sharpest ingredient and nutrition text.
                  </p>
                </div>

                <label className="glass-button-primary flex w-full cursor-pointer items-center justify-center gap-2 py-4 text-base">
                  <span aria-hidden="true">📷</span>
                  <span>Take photo</span>
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </label>

                <label className="glass-surface flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl px-5 py-3 text-center transition hover:bg-white/80">
                  <span aria-hidden="true">🖼️</span>
                  <span className="text-sm font-bold text-slate-800">
                    Upload from gallery
                  </span>
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </label>

                <div className="w-full rounded-2xl bg-white/45 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[.13em] text-emerald-700">
                    For a sharp scan
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-slate-600">
                    Hold the packet flat, fill most of the frame with the label, tap the text to focus, and avoid glare.
                  </p>
                </div>
              </>
            ) : (
              <>
                <img
                  src={preview}
                  alt="Selected food label"
                  className="max-h-[420px] w-full rounded-2xl bg-black/5 object-contain shadow-sm"
                />

                <div className="grid w-full grid-cols-2 gap-2">
                  <label className="cursor-pointer rounded-xl bg-white/70 px-4 py-3 text-center text-xs font-bold text-slate-800">
                    📷 Retake
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </label>

                  <label className="cursor-pointer rounded-xl bg-white/70 px-4 py-3 text-center text-xs font-bold text-slate-800">
                    🖼️ Gallery
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </label>
                </div>

                <button
                  type="button"
                  onClick={handleSubmit}
                  className="glass-button-primary w-full py-4 text-base disabled:pointer-events-none disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? "Analyzing image..." : "Analyze label"}
                </button>

                <button
                  type="button"
                  onClick={clearImage}
                  className="text-xs font-semibold text-slate-500"
                >
                  Remove photo
                </button>
              </>
            )}
          </div>
        )}

        {aiData && (
          <div className="mt-4 w-full max-w-4xl">
            <ProductSummery
              aiData={aiData}
              productName={aiData.product_name || "Unknown product"}
              imageFrontUrl={preview}
            />
          </div>
        )}
      </div>
    </main>
  );
};

export default ImageUpload;
