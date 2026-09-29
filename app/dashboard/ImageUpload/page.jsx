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
  const [cameraError, setCameraError] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const { profile } = useUserProfile();

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];

    if (file) {
      stopCamera();
      setImage(file);
      setPreview(URL.createObjectURL(file));
      setAiData(null);
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const openCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access is not supported by this browser. Please use the gallery.");
      return;
    }

    setCameraError("");
    setCameraActive(false);

    try {
      streamRef.current?.getTracks().forEach((track) => track.stop());

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      setCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (error) {
      console.error("Camera access error:", error);
      setCameraActive(false);
      setCameraError(
        "Camera access was blocked or unavailable. Please allow camera permission, or use the gallery below."
      );
    }
  };

  useEffect(() => {
    openCamera();

    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setCameraActive(false);
    };
  }, []);

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
        <div className="glass-panel flex w-full max-w-xl flex-col items-center gap-5 p-5 sm:p-8">
          {/* Image Preview */}
          {preview && (
            <img
              src={preview}
              alt="Uploaded"
              className="h-64 w-full rounded-2xl object-cover shadow-lg mb-1"
            />
          )}

          {/* Gallery upload — kept above the camera as the secondary option */}
          <label className="glass-surface flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl px-5 py-3 text-center transition hover:-translate-y-0.5 hover:bg-white/80">
            <span className="text-lg" aria-hidden="true">🖼️</span>
            <span className="text-sm font-bold text-slate-800">
              Upload from gallery
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
          </label>

          {/* Primary camera */}
          {!image ? (
            <div className="w-full overflow-hidden rounded-3xl border border-white/40 bg-slate-950 shadow-xl">
              <div className="relative h-[180px] sm:h-[210px] bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />

                {!cameraActive && !cameraError && (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
                    Starting camera…
                  </div>
                )}

                {cameraError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 p-6 text-center text-sm leading-6 text-white">
                    {cameraError}
                  </div>
                )}
              </div>

              <div className="p-4">
                <button
                  type="button"
                  onClick={capturePhoto}
                  disabled={Boolean(cameraError) || !cameraActive}
                  className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  📷 Capture photo
                </button>

                {cameraError && (
                  <button
                    type="button"
                    onClick={openCamera}
                    className="mt-2 w-full rounded-xl bg-white/10 py-3 text-sm font-semibold text-white hover:bg-white/20"
                  >
                    ↻ Restart camera
                  </button>
                )}
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setImage(null);
                setPreview(null);
                setAiData(null);
                setCameraError("");
                openCamera();
              }}
              className="w-full rounded-xl bg-white/60 px-5 py-3 text-sm font-bold text-slate-800 transition hover:bg-white/80"
            >
              ↻ Retake photo
            </button>
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
