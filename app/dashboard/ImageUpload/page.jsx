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
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const { profile } = useUserProfile();

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];

    if (file) {
      setImage(file);
      setPreview(URL.createObjectURL(file));
      setAiData(null);
    }
  };

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraOpen(false);
  };

  const openCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access is not supported by this browser.");
      setCameraOpen(true);
      return;
    }

    setCameraError("");
    setCameraOpen(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (error) {
      console.error("Camera access error:", error);
      setCameraError(
        "Camera access was blocked or unavailable. Please allow camera permission or use the gallery instead."
      );
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;

    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraError("Camera is still starting. Please try again in a moment.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");

    if (!context) {
      setCameraError("Could not capture the camera frame.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError("Could not create the captured image.");
          return;
        }

        const file = new File(
          [blob],
          `veronica-camera-${Date.now()}.jpg`,
          { type: "image/jpeg" }
        );

        setImage(file);
        setPreview(URL.createObjectURL(file));
        setAiData(null);
        stopCamera();
      },
      "image/jpeg",
      0.92
    );
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
          dietaryPreferences: profile?.dietaryPreferences || null,
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

          {/* Image source */}
          <div className="grid w-full gap-3 sm:grid-cols-2">
            <label className="glass-surface flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl px-6 py-5 text-center transition hover:-translate-y-0.5 hover:bg-white/80">
              <span className="text-2xl" aria-hidden="true">🖼️</span>
              <span className="mt-2 text-sm font-bold text-slate-800">
                Choose from gallery
              </span>
              <span className="mt-1 text-xs text-slate-500">
                Select a food-label photo
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
            </label>

            <button
              type="button"
              onClick={openCamera}
              className="glass-surface flex min-h-28 flex-col items-center justify-center rounded-2xl px-6 py-5 text-center transition hover:-translate-y-0.5 hover:bg-white/80"
            >
              <span className="text-2xl" aria-hidden="true">📷</span>
              <span className="mt-2 text-sm font-bold text-slate-800">
                Take a photo
              </span>
              <span className="mt-1 text-xs text-slate-500">
                Use your camera
              </span>
            </button>
          </div>

          {cameraOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
              <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/30 bg-slate-950 shadow-2xl">
                <div className="flex items-center justify-between px-5 py-4 text-white">
                  <div>
                    <p className="text-sm font-bold">Take a food-label photo</p>
                    <p className="mt-1 text-xs text-slate-300">
                      Keep the ingredients or nutrition panel clear and in focus.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20"
                  >
                    Close
                  </button>
                </div>

                <div className="relative aspect-[4/3] bg-black">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full object-cover"
                  />
                  {!streamRef.current && !cameraError && (
                    <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
                      Starting camera…
                    </div>
                  )}
                </div>

                {cameraError && (
                  <p className="px-5 pt-4 text-xs leading-5 text-rose-300">
                    {cameraError}
                  </p>
                )}

                <div className="flex gap-3 p-5">
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="flex-1 rounded-xl bg-white/10 py-3 text-sm font-bold text-white hover:bg-white/20"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={capturePhoto}
                    disabled={Boolean(cameraError)}
                    className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Capture photo
                  </button>
                </div>
              </div>
            </div>
          )}

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
