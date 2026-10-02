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

    return (
    <main className="min-h-[calc(100vh-72px)] bg-[#f4f5f2]/95 px-3 py-4 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-2xl">
        {!aiData && (
          <section className="overflow-hidden rounded-[1.25rem] border border-slate-200/80 bg-white shadow-[0_10px_30px_rgba(15,23,42,.05)]">
            <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
              <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-emerald-700">
                Analyze
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-[-.03em] text-slate-950 sm:text-2xl">
                Scan a food label
              </h1>
              <p className="mt-1.5 max-w-xl text-[12px] leading-5 text-slate-500 sm:text-sm">
                Keep the ingredients or nutrition panel inside the frame.
              </p>
            </div>

            {!image ? (
              <div className="p-3 sm:p-4">
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[1rem] bg-slate-950 sm:aspect-[4/3]">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full object-cover"
                  />

                  {cameraStarting && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950 text-xs font-medium text-white/70">
                      Starting camera…
                    </div>
                  )}

                  {cameraError && !cameraStarting && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950 p-6 text-center">
                      <p className="max-w-xs text-xs leading-5 text-white/75">
                        {cameraError}
                      </p>
                      <button
                        type="button"
                        onClick={openCamera}
                        className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-slate-950 transition active:scale-[.98]"
                      >
                        Try again
                      </button>
                    </div>
                  )}

                  {cameraActive && !cameraError && (
                    <>
                      <div className="pointer-events-none absolute inset-[10%] rounded-[1rem] border border-white/75">
                        <span className="absolute -left-px -top-px h-7 w-7 rounded-tl-[1rem] border-l-2 border-t-2 border-white" />
                        <span className="absolute -right-px -top-px h-7 w-7 rounded-tr-[1rem] border-r-2 border-t-2 border-white" />
                        <span className="absolute -bottom-px -left-px h-7 w-7 rounded-bl-[1rem] border-b-2 border-l-2 border-white" />
                        <span className="absolute -bottom-px -right-px h-7 w-7 rounded-br-[1rem] border-b-2 border-r-2 border-white" />
                      </div>
                      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1.5 text-[9px] font-medium text-white/90 backdrop-blur-sm">
                        Keep text sharp · avoid glare
                      </div>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={capturePhoto}
                  disabled={!cameraActive || capturing}
                  className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-900 active:scale-[.99] disabled:pointer-events-none disabled:opacity-40"
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <rect x="3" y="6" width="18" height="13" rx="3" />
                    <path d="M8 6l1.5-2h5L16 6" />
                    <circle cx="12" cy="12.5" r="3.25" />
                  </svg>
                  <span>{capturing ? "Capturing…" : "Capture label"}</span>
                </button>

                <label className="mt-2 flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[.99]">
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-4 w-4 text-slate-500"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="M12 16V4" />
                    <path d="M7.5 8.5L12 4l4.5 4.5" />
                    <path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
                  </svg>
                  <span>Upload from gallery</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleGalleryUpload}
                  />
                </label>

                <div className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 10v6" />
                    <path d="M12 7.5h.01" />
                  </svg>
                  <p className="text-[10px] leading-4 text-slate-500 sm:text-[11px]">
                    Best results: keep the packet flat, fill most of the frame,
                    focus on the text, and avoid reflections.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3 sm:p-4">
                <div className="overflow-hidden rounded-[1rem] border border-slate-200 bg-slate-50">
                  <img
                    src={preview}
                    alt="Captured food label"
                    className="max-h-[460px] w-full object-contain"
                  />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={retakePhoto}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[.99]"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="M4 7v5h5" />
                      <path d="M5.5 11a7 7 0 1 1 1.2 6.3" />
                    </svg>
                    Retake
                  </button>

                  <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[.99]">
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="M12 16V4" />
                      <path d="M7.5 8.5L12 4l4.5 4.5" />
                      <path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
                    </svg>
                    Gallery
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
                  disabled={loading}
                  className="mt-2 flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 active:scale-[.99] disabled:pointer-events-none disabled:opacity-50"
                >
                  {loading ? "Analyzing…" : "Analyze label"}
                </button>
              </div>
            )}
          </section>
        )}

        {aiData && (
          <div className="w-full">
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
