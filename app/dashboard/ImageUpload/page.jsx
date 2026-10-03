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
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraStarting, setCameraStarting] = useState(true);
  const [capturing, setCapturing] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const { profile } = useUserProfile();

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraActive(false);
  };

  const openCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        "Live camera is not supported by this browser. Use Upload from gallery instead."
      );
      setCameraStarting(false);
      return;
    }

    setCameraError("");
    setCameraStarting(true);
    stopCamera();

    try {
      // First request permission so device labels are available.
      const permissionStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      permissionStream.getTracks().forEach((track) => track.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(
        (device) => device.kind === "videoinput"
      );

      const rearCameras = videoInputs.filter((device) => {
        const label = (device.label || "").toLowerCase();
        return !/front|user|selfie/i.test(label);
      });

      const cameraPool = rearCameras.length ? rearCameras : videoInputs;

      const preferredCamera =
        cameraPool.find((device) =>
          /camera\s*0|main|primary|standard|back camera/i.test(
            device.label || ""
          )
        ) ||
        cameraPool.find(
          (device) =>
            !/ultra.?wide|0\.5x|telephoto|tele|zoom|macro/i.test(
              device.label || ""
            )
        ) ||
        cameraPool[0];

      const stream = await navigator.mediaDevices.getUserMedia({
        video: preferredCamera?.deviceId
          ? {
              deviceId: { exact: preferredCamera.deviceId },
              width: { ideal: 3840 },
              height: { ideal: 2160 },
              frameRate: { ideal: 30, max: 30 },
            }
          : {
              facingMode: { ideal: "environment" },
              width: { ideal: 3840 },
              height: { ideal: 2160 },
              frameRate: { ideal: 30, max: 30 },
            },
        audio: false,
      });

      streamRef.current = stream;

      const video = videoRef.current;

      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error("Camera preview is unavailable.");
      }

      video.srcObject = stream;
      video.muted = true;
      video.setAttribute("playsinline", "true");
      await video.play();

      const track = stream.getVideoTracks()[0];
      const capabilities = track?.getCapabilities?.();

      if (
        track?.applyConstraints &&
        Array.isArray(capabilities?.focusMode) &&
        capabilities.focusMode.includes("continuous")
      ) {
        try {
          await track.applyConstraints({
            advanced: [{ focusMode: "continuous" }],
          });
        } catch (error) {
          console.warn("Continuous autofocus unavailable:", error);
        }
      }

      setCameraActive(true);
    } catch (error) {
      console.error("Camera access error:", error);

      const messages = {
        NotAllowedError:
          "Camera permission is blocked. Allow camera access for Veronica, then try again.",
        NotFoundError:
          "No rear camera was found. Use Upload from gallery instead.",
        NotReadableError:
          "The camera is busy in another app. Close it and try again.",
        OverconstrainedError:
          "This camera does not support the requested settings. Try again.",
        SecurityError:
          "The browser blocked camera access for security reasons.",
      };

      setCameraError(
        messages[error?.name] ||
          "Could not start the camera. Use Upload from gallery or try again."
      );
      stopCamera();
    } finally {
      setCameraStarting(false);
    }
  };

  useEffect(() => {
    openCamera();

    return () => {
      stopCamera();
    };
    // Open once when the Upload Food Label page loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    const nextPreview = URL.createObjectURL(file);

    setImage(file);
    setPreview(nextPreview);
    setAiData(null);
    stopCamera();
  };

  const handleGalleryUpload = (event) => {
    const file = event.target.files?.[0];
    setSelectedImage(file);
    event.target.value = "";
  };

  const saveCapturedBlob = (blob) => {
    if (!blob) {
      throw new Error("Could not create the captured image.");
    }

    const extension = blob.type === "image/png" ? "png" : "jpg";
    const file = new File(
      [blob],
      `veronica-label-${Date.now()}.${extension}`,
      { type: blob.type || "image/jpeg" }
    );

    setSelectedImage(file);
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    const track = streamRef.current?.getVideoTracks?.()[0];

    if (!video || !track || !video.videoWidth || !video.videoHeight) {
      toast.error("Camera is still starting. Try again in a moment.");
      return;
    }

    setCapturing(true);

    try {
      // Prefer a real still capture when the browser supports ImageCapture.
      // This is normally sharper than copying a frame from the video preview.
      if (typeof window !== "undefined" && "ImageCapture" in window) {
        try {
          const imageCapture = new window.ImageCapture(track);
          const blob = await imageCapture.takePhoto();

          if (blob?.size) {
            saveCapturedBlob(blob);
            return;
          }
        } catch (error) {
          console.warn("High-resolution still capture unavailable:", error);
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Could not capture the camera frame.");
      }

      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.96)
      );

      saveCapturedBlob(blob);
    } catch (error) {
      console.error("Photo capture failed:", error);
      toast.error(error?.message || "Could not capture the photo.");
    } finally {
      setCapturing(false);
    }
  };

  const handleSubmit = async () => {
    if (!image) {
      toast.error("Capture or upload a photo first.");
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

  const retakePhoto = async () => {
    if (preview?.startsWith("blob:")) {
      URL.revokeObjectURL(preview);
    }

    setImage(null);
    setPreview(null);
    setAiData(null);
    await openCamera();
  };

  return (
    <main className="app-canvas">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center">
        {!aiData && (
          <div className="glass-panel flex w-full max-w-xl flex-col items-center gap-3 p-3 sm:gap-4 sm:p-6">
            {!image ? (
              <>
                <div className="w-full text-center">
                  <p className="text-lg font-semibold tracking-[-.03em] text-slate-950 sm:text-xl">
                    Scan the food label
                  </p>
                  <p className="mt-1.5 text-[11px] leading-5 text-slate-500 sm:text-xs">
                    Keep the ingredient or nutrition panel inside the frame.
                  </p>
                </div>

                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-slate-950 sm:aspect-[4/3]">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full object-cover"
                  />

                  {cameraStarting && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950 text-xs font-semibold text-white/70">
                      Starting camera…
                    </div>
                  )}

                  {cameraError && !cameraStarting && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/95 p-6 text-center">
                      <p className="text-xs leading-5 text-white/80">
                        {cameraError}
                      </p>
                      <button
                        type="button"
                        onClick={openCamera}
                        className="liquid-glass-button px-4 py-2 text-xs font-bold text-slate-900"
                      >
                        Try camera again
                      </button>
                    </div>
                  )}

                  {cameraActive && !cameraError && (
                    <>
                      <div className="pointer-events-none absolute inset-[12%] rounded-2xl border border-white/70" />
                      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1.5 text-[9px] font-semibold text-white/90 backdrop-blur">
                        Keep text sharp · avoid glare
                      </div>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={capturePhoto}
                  disabled={!cameraActive || capturing}
                  className="liquid-glass-button flex w-full items-center justify-center gap-2 py-4 text-base disabled:pointer-events-none disabled:opacity-50"
                >
                  <span aria-hidden="true">●</span>
                  <span>{capturing ? "Capturing…" : "Capture"}</span>
                </button>

                <label className="liquid-glass-button flex w-full cursor-pointer items-center justify-center gap-2 px-5 py-3 text-center">
                  <span aria-hidden="true">🖼️</span>
                  <span className="text-xs font-bold text-slate-800 sm:text-sm">
                    Upload from gallery
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleGalleryUpload}
                  />
                </label>
              </>
            ) : (
              <>
                <img
                  src={preview}
                  alt="Captured food label"
                  className="max-h-[430px] w-full rounded-2xl bg-black/5 object-contain shadow-sm"
                />

                <div className="grid w-full grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={retakePhoto}
                    className="liquid-glass-button px-4 py-3 text-center text-xs font-bold text-slate-800"
                  >
                    📷 Retake
                  </button>

                  <label className="liquid-glass-button cursor-pointer px-4 py-3 text-center text-xs font-bold text-slate-800">
                    🖼️ Gallery
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleGalleryUpload}
                    />
                  </label>
                </div>

                <button
                  type="button"
                  onClick={handleSubmit}
                  className="liquid-glass-button w-full py-4 text-base disabled:pointer-events-none disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? "Analyzing image..." : "Analyze label"}
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
