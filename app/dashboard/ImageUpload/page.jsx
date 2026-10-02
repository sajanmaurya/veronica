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

      // Ask for permission first so camera labels become available. Phones
      // often expose main, ultra-wide and telephoto rear lenses; simply using
      // facingMode="environment" can choose a lens that cannot focus well on
      // nearby nutrition labels.
      const permissionStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      permissionStream.getTracks().forEach((track) => track.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((device) => device.kind === "videoinput");

      const rearCameras = videoInputs.filter((device) => {
        const label = (device.label || "").toLowerCase();
        return (
          !/front|user|selfie/i.test(label) &&
          (/back|rear|environment|facing back/i.test(label) || videoInputs.length === 1)
        );
      });

      const cameraPool = rearCameras.length ? rearCameras : videoInputs;

      const preferredCamera =
        cameraPool.find((device) =>
          /camera\s*0|camera2\s*0|0,?\s*facing\s*back|main|primary|standard/i.test(
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

      const videoConstraints = preferredCamera?.deviceId
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
          };

      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });

      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error("Camera preview element is unavailable.");
      }

      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      video.muted = true;
      await video.play();

      const track = stream.getVideoTracks()[0];
      const capabilities = track?.getCapabilities?.();

      // Continuous autofocus makes a big difference for close-up text.
      if (
        track?.applyConstraints &&
        Array.isArray(capabilities?.focusMode) &&
        capabilities.focusMode.includes("continuous")
      ) {
        try {
          await track.applyConstraints({
            advanced: [{ focusMode: "continuous" }],
          });
        } catch (focusError) {
          console.warn("Continuous autofocus is not available:", focusError);
        }
      }

      console.log("Veronica label camera:", {
        selected: preferredCamera?.label || "environment camera",
        settings: track?.getSettings?.(),
        focusModes: capabilities?.focusMode,
      });

      // Give autofocus a brief moment before enabling capture.
      await new Promise((resolve) => window.setTimeout(resolve, 350));
      setCameraActive(true);
    } catch (error) {
      console.error("Camera access error:", error);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setCameraActive(false);

      const errorCode = error?.name || "UnknownError";
      const messages = {
        NotAllowedError:
          "Camera permission is blocked. Allow camera access for Veronica in your browser settings, then try again.",
        NotFoundError:
          "No camera was found on this device. You can use the device camera button or upload an image instead.",
        NotReadableError:
          "The camera is currently unavailable. Close other apps using the camera, then try again.",
        OverconstrainedError:
          "This camera does not support the requested settings. Try again or use the device camera button.",
        SecurityError:
          "The browser blocked camera access for security reasons. Check the site's camera permission and try again.",
      };

      setCameraError(
        messages[errorCode] ||
          "Live camera access is unavailable. You can use the device camera button or upload an image instead."
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

  const saveCapturedBlob = (blob) => {
    if (!blob) {
      setCameraError("Could not create the captured image.");
      return;
    }

    const file = new File(
      [blob],
      `veronica-camera-${Date.now()}.${blob.type === "image/png" ? "png" : "jpg"}`,
      { type: blob.type || "image/jpeg" }
    );

    setImage(file);
    setPreview(URL.createObjectURL(file));
    setAiData(null);
    stopCamera();
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    const track = streamRef.current?.getVideoTracks?.()[0];

    if (!video || !video.videoWidth || !video.videoHeight || !track) {
      setCameraError("Camera is still starting. Please try again in a moment.");
      return;
    }

    // ImageCapture asks the camera for a real still photo, which is usually
    // much sharper and higher resolution than copying the live video frame.
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

    // Safe fallback for browsers without ImageCapture.
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
      (blob) => saveCapturedBlob(blob),
      "image/jpeg",
      0.96
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
              className="max-h-80 w-full rounded-2xl bg-black/5 object-contain shadow-lg mb-1"
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

          {/* Native device-camera fallback. This can work when live camera access is blocked. */}
          {cameraError && !image && (
            <label className="glass-surface flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl px-5 py-3 text-center transition hover:-translate-y-0.5 hover:bg-white/80">
              <span className="text-lg" aria-hidden="true">📷</span>
              <span className="text-sm font-bold text-slate-800">
                Use device camera
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleImageUpload}
              />
            </label>
          )}

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

                {cameraActive && (
                  <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1.5 text-[10px] font-semibold text-white/90 backdrop-blur">
                    Keep label flat · move back slightly if text is soft
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
