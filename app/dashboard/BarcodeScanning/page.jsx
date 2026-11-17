"use client";

import React, { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import {
  BarcodeFormat,
  ChecksumException,
  DecodeHintType,
  FormatException,
  NotFoundException,
} from "@zxing/library";
import { toast } from "react-toastify";
import ProductSummery from "@/app/_components/ProductSummery";
import { useUserProfile } from "@/context/UserProfileContext";
import { getPreferredBarcodeCamera, sortBarcodeCameras } from "@/lib/barcodeCamera.mjs";

const BARCODE_CACHE_DB = "veronica-barcode-cache-v3";
const BARCODE_CACHE_STORE = "products";
const BARCODE_CACHE_TTL = 1000 * 60 * 60 * 24 * 7;
const SCAN_SUCCESS_ANIMATION_MS = 350;
const SCAN_THOROUGH_MODE_DELAY_MS = 1000;

function openBarcodeCache() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      resolve(null);
      return;
    }
    const request = window.indexedDB.open(BARCODE_CACHE_DB, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(BARCODE_CACHE_STORE, { keyPath: "barcode" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getCachedBarcode(barcode) {
  try {
    const db = await openBarcodeCache();
    if (!db) return null;
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(BARCODE_CACHE_STORE, "readonly");
      const request = tx.objectStore(BARCODE_CACHE_STORE).get(barcode);
      request.onsuccess = () => {
        const item = request.result;
        resolve(item && Date.now() - item.cachedAt < BARCODE_CACHE_TTL ? item.data : null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn("Barcode cache read failed:", error);
    return null;
  }
}

async function cacheBarcode(barcode, data) {
  try {
    const db = await openBarcodeCache();
    if (!db) return;
    await new Promise((resolve, reject) => {
      const tx = db.transaction(BARCODE_CACHE_STORE, "readwrite");
      tx.objectStore(BARCODE_CACHE_STORE).put({ barcode, data, cachedAt: Date.now() });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.warn("Barcode cache write failed:", error);
  }
}

const BarcodeScanning = () => {
  const [scanning, setScanning] = useState(false);
  const [data, setData] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiData, setAiData] = useState(null);
  const [cameraError, setCameraError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [barcodeDetected, setBarcodeDetected] = useState(false);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const scanLocked = useRef(false);
  const scanGeneration = useRef(0);
  const controlsRef = useRef(null);
  const streamRef = useRef(null);
  const videoRef = useRef(null);
  const detectionTimerRef = useRef(null);
  const thoroughModeTimerRef = useRef(null);

  const { profile } = useUserProfile();
  const preferredCameraId = getPreferredBarcodeCamera(availableCameras)?.deviceId || "";

  const stopScanner = () => {
    // Invalidate camera requests that have not finished yet (permission dialogs,
    // device startup, etc.), so an old request cannot restart a stopped scan.
    scanGeneration.current += 1;
    if (thoroughModeTimerRef.current) window.clearTimeout(thoroughModeTimerRef.current);
    thoroughModeTimerRef.current = null;
    try { controlsRef.current?.stop?.(); } catch {}
    controlsRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
  };

  const startScanner = async (requestedCameraId = "") => {
    if (scanLocked.current) return;
    stopScanner();
    if (detectionTimerRef.current) window.clearTimeout(detectionTimerRef.current);
    detectionTimerRef.current = null;
    const generation = scanGeneration.current;
    setCameraError("");
    setScanning(true);
    setBarcodeDetected(false);
    setAvailableCameras([]);
    setSelectedCameraId("");

    try {
      if (!window.isSecureContext) {
        throw new Error("Camera access requires HTTPS or localhost. Open Veronica using its secure URL.");
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera access is not supported in this browser.");
      }

      // Once permission has been granted, Android usually exposes real camera
      // labels. Select the main rear lens before opening a stream so we don't
      // accidentally start a blurry ultra-wide or telephoto camera.
      let cameraId = requestedCameraId;
      if (!cameraId) {
        try {
          const devices = await BrowserMultiFormatReader.listVideoInputDevices();
          if (generation !== scanGeneration.current) return;
          cameraId = getPreferredBarcodeCamera(devices)?.deviceId || "";
        } catch (deviceError) {
          console.warn("Camera selection will use the browser default:", deviceError);
        }
      }

      const preferredVideo = cameraId
        ? { deviceId: { exact: cameraId }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } };
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: preferredVideo,
        });
      } catch (error) {
        // If the automatically selected camera became unavailable, retry the
        // browser's rear-camera default. Never silently replace an explicitly
        // selected lens with a different one.
        if (requestedCameraId || !["NotFoundError", "NotReadableError", "OverconstrainedError"].includes(error?.name)) {
          throw error;
        }
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: cameraId ? { facingMode: { ideal: "environment" } } : true,
          });
        } catch (fallbackError) {
          if (!["NotFoundError", "OverconstrainedError"].includes(fallbackError?.name)) throw fallbackError;
          stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
        }
      }

      if (generation !== scanGeneration.current || scanLocked.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        throw new Error("Camera preview element is not available.");
      }

      const track = stream.getVideoTracks()[0];
      const capabilities = track?.getCapabilities?.();

      if (capabilities?.focusMode?.includes("continuous") && track?.applyConstraints) {
        try {
          await track.applyConstraints({ advanced: [{ focusMode: "continuous" }] });
        } catch (focusError) {
          console.warn("Barcode autofocus unavailable:", focusError);
        }
      }

      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
      ]);

      const reader = new BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: 120,
        delayBetweenScanSuccess: 120,
      });
      // Let ZXing attach/play the stream and own its decoder cleanup.
      const controls = await reader.decodeFromStream(
        stream, video,
        (result, error, controls) => {
          if (generation !== scanGeneration.current) return;
          if (result && !scanLocked.current && !detectionTimerRef.current) {
            const value = String(result.getText?.() || "").trim();
            if (value) handleScan(value, true);
          } else if (
            error &&
            !(error instanceof NotFoundException) &&
            !(error instanceof ChecksumException) &&
            !(error instanceof FormatException)
          ) {
            // ZXing stops decoding on unexpected canvas/video errors. Without
            // reporting them, the preview stays open but never finds barcodes.
            console.error("Barcode frame decoding stopped:", error);
            try { controls?.stop?.(); } catch {}
            stopScanner();
            setScanning(false);
            setCameraError("Camera preview opened, but barcode reading stopped. Try another camera or restart the scanner.");
          }
        }
      );

      if (generation !== scanGeneration.current || (scanLocked.current && !detectionTimerRef.current)) {
        controls.stop();
        return;
      }
      controlsRef.current = controls;

      setCameraReady(true);

      // Start with ZXing's normal, faster 1D pass. Only spend extra CPU on
      // TRY_HARDER if the barcode has not been recognized after a short wait.
      thoroughModeTimerRef.current = window.setTimeout(() => {
        thoroughModeTimerRef.current = null;
        if (generation !== scanGeneration.current || scanLocked.current || detectionTimerRef.current) return;
        hints.set(DecodeHintType.TRY_HARDER, true);
        reader.setHints(hints);
      }, SCAN_THOROUGH_MODE_DELAY_MS);

      // Enumerating camera lenses must never delay or prevent decoding.
      // After permission is granted, labels let users change to a main rear
      // lens if the automatic selection looks blurry.
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (generation !== scanGeneration.current) return;
        setAvailableCameras(sortBarcodeCameras(devices));
        setSelectedCameraId(track?.getSettings?.().deviceId || "");
      } catch (deviceError) {
        console.warn("Could not list cameras:", deviceError);
        if (generation === scanGeneration.current) setAvailableCameras([]);
      }
    } catch (error) {
      if (generation !== scanGeneration.current) return;
      console.error("ZXing scanner startup failed:", error);
      stopScanner();
      setScanning(false);
      setCameraError(
        requestedCameraId
          ? "That camera lens could not start. Press Start camera scanner to use the recommended rear lens."
          : error?.name === "NotAllowedError"
          ? "Camera permission was denied. Allow camera access for Veronica and try again."
          : error?.name === "NotReadableError"
          ? "The camera is being used by another app. Close it and try again."
          : error?.name === "NotFoundError"
          ? "No camera was found on this device."
          : error?.message || "Unable to start the barcode scanner."
      );
    }
  };

  useEffect(() => {
    // Start only on a user tap/click. Mobile browsers can reject camera/video
    // playback initiated automatically during page mount.
    return () => {
      if (detectionTimerRef.current) window.clearTimeout(detectionTimerRef.current);
      stopScanner();
    };
  }, []);

  const [imageFrontUrl, setImageFrontUrl] = useState("");
  const [imageNutritionImage, setImageNutritionImage] = useState("");
  const [productName, setProductName] = useState("");
  const [barcodeNotFound, setBarcodeNotFound] = useState(false);
  const [fallbackLoading, setFallbackLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);

  // =====================================================
  // BARCODE SCANNER
  // =====================================================

  const handleScan = (barcode, fromCamera = false) => {
    const cleanBarcode = String(barcode || "").trim();
    if (!cleanBarcode || scanLocked.current || loading) return;

    scanLocked.current = true;
    setData(cleanBarcode);
    if (fromCamera) {
      // Keep the preview visible for a short confirmation, while the product
      // request starts immediately in parallel. Never make the network wait
      // for the animation to finish.
      setBarcodeDetected(true);
      setLoading(true);
      detectionTimerRef.current = window.setTimeout(() => {
        detectionTimerRef.current = null;
        stopScanner();
        setScanning(false);
        setBarcodeDetected(false);
      }, SCAN_SUCCESS_ANIMATION_MS);
      getResult(cleanBarcode);
    } else {
      stopScanner();
      setScanning(false);
      getResult(cleanBarcode);
    }
  };

  // =====================================================
  // GET PRODUCT
  // =====================================================

  const getResult = async (barcode) => {
    if (!barcode || !String(barcode).trim()) {
      toast.error("Barcode is required");
      return;
    }

    try {
      setLoading(true);

      const cleanBarcode = String(barcode).trim();

      setBarcodeNotFound(false);

      const cachedProduct = await getCachedBarcode(cleanBarcode);
      let response;

      if (cachedProduct) {
        response = { success: true, data: cachedProduct, cached: true };
        toast.success("Product found in offline cache");
      } else {
        const result = await fetch(
          `/api/scanBarcode/${encodeURIComponent(cleanBarcode)}`
        );
        response = await result.json();
        if (!result.ok && result.status !== 404) {
          throw new Error(response.error || "The food database is temporarily unavailable. Please try again.");
        }
      }

      console.log("Barcode API Response:", response);

      if (!response.success || !response.data) {
        setBarcodeNotFound(true);
        scanLocked.current = false;
        toast.info("Product not in the barcode database. You can scan its label instead.");
        return;
      }

      // Offline caching is best-effort; do not hold up the product result.
      void cacheBarcode(cleanBarcode, response.data);

      toast.success("Product Found");

      const product = response.data;

      // Product details
      const frontImage = product.image_front_url || "";
      const nutritionImage = product.image_nutrition_url || "";
      const name = product.product_name || "Unknown Product";

      setImageFrontUrl(frontImage);
      setImageNutritionImage(nutritionImage);
      setProductName(name);

      console.log(
        "Cleaned Product Data:",
        JSON.stringify(product)
      );

      // Analyze the product with Groq
      await analyzeProduct(
        JSON.stringify(product),
        name,
        frontImage,
        nutritionImage
      );

    } catch (error) {
      console.error("Error fetching product:", error);
      scanLocked.current = false;
      toast.error(error?.message || "Something went wrong while fetching the product.");
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // GEMINI AI ANALYSIS
  // =====================================================

  const analyzeProduct = async (
    productData,
    currentProductName,
    currentImageFrontUrl,
    currentImageNutritionImage
  ) => {
    try {
      setLoading(true);

      const response = await fetch("/api/analyzeBarcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: JSON.parse(productData),
          profile: {
            diseases: profile?.diseases || "",
            allergies: profile?.allergies || "",
            dietaryPreferences: profile?.dietaryPreferences || "",
          },
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.message || "Barcode product analysis failed.");
      }

      setAiData(result.data);

      try {
        const saveResponse = await fetch("/api/previousSearches/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productName: currentProductName || "Unknown Product",
            imageFrontUrl: currentImageFrontUrl || null,
            imageNutritionImage: currentImageNutritionImage || null,
            aiData: result.data,
          }),
        });

        if (saveResponse.status !== 401 && !saveResponse.ok) {
          console.error("Failed to save previous search:", await saveResponse.json());
        }
      } catch (saveError) {
        console.error("Error saving previous search:", saveError);
      }

      toast.success("Product analysis completed!");
    } catch (error) {
      console.error("Error analyzing barcode product:", error);
      toast.error(error?.message || "Something went wrong while analyzing the product.");
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // RESET
  // =====================================================

  const handleVisionFallback = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFallbackLoading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append(
        "profile",
        JSON.stringify({
          diseases: profile?.diseases || "",
          allergies: profile?.allergies || "",
          dietaryPreferences: profile?.dietaryPreferences || "",
        })
      );

      const response = await fetch("/api/analyzeImage", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || "Vision analysis failed.");
      }

      setAiData(result.data);
      setProductName(result.data.product_name || "Unknown product");
      setImageFrontUrl(URL.createObjectURL(file));
      setBarcodeNotFound(false);
      toast.success("Label analyzed with Vision AI");
    } catch (error) {
      console.error("Vision fallback failed:", error);
      toast.error(error?.message || "Could not analyze the label.");
    } finally {
      setFallbackLoading(false);
    }
  };


  const handleVerifyPackage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setVerifyLoading(true);

    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append(
        "profile",
        JSON.stringify({
          diseases: profile?.diseases || "",
          allergies: profile?.allergies || "",
          dietaryPreferences: profile?.dietaryPreferences || "",
        })
      );

      const response = await fetch("/api/analyzeImage", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || "Package verification failed.");
      }

      const scan = result.data;
      const scannedIngredients =
        Array.isArray(scan.ingredients) && scan.ingredients.length > 0;
      const scannedNutrition =
        scan.nutrition &&
        Object.entries(scan.nutrition).some(
          ([key, value]) =>
            !["serving_size", "label_basis", "servings_per_container"].includes(key) &&
            value != null
        );

      setAiData((current) => {
        if (!current) return scan;

        const nextIngredients = scannedIngredients
          ? scan.ingredients
          : current.ingredients || [];

        const nextNutrition = scannedNutrition
          ? scan.nutrition
          : current.nutrition || {};

        const nextQuantity =
          scan.package_quantity || current.product_quantity || null;

        const ingredientsSource = scannedIngredients
          ? "package_scan"
          : current.ingredients_source || "unavailable";

        const nutritionSource = scannedNutrition
          ? "package_scan"
          : current.nutrition_source || "unavailable";

        const quantitySource = scan.package_quantity
          ? "package_scan"
          : current.data_sources?.quantity || "unavailable";

        return {
          ...current,
          ...(scannedIngredients || scannedNutrition
            ? {
                rating: null,
                rating_verified: false,
                nutrition_score: scannedNutrition ? scan.nutrition_score : current.nutrition_score,
                summary: scan.summary,
                harmful_ingredients: scan.harmful_ingredients,
                ingredient_explanations: scan.ingredient_explanations,
                user_specific_summary: scan.user_specific_summary,
              }
            : {}),
          ingredients: nextIngredients,
          ingredients_source: ingredientsSource,
          nutrition: nextNutrition,
          nutrition_source: nutritionSource,
          nutrition_validation: scannedNutrition
            ? scan.nutrition_validation
            : current.nutrition_validation,
          product_quantity: nextQuantity,
          pack_size_verified:
            Boolean(scan.package_quantity) || current.pack_size_verified,
          data_sources: {
            ...(current.data_sources || {}),
            ingredients: ingredientsSource,
            nutrition: nutritionSource,
            quantity: quantitySource,
          },
          verification_required:
            ingredientsSource === "unavailable" ||
            nutritionSource === "unavailable" ||
            quantitySource === "unavailable" ||
            !(scannedNutrition ? scan.nutrition_score : current.nutrition_score)?.grade,
        };
      });

      setImageNutritionImage(URL.createObjectURL(file));
      toast.success("Package data verified from your photo");
    } catch (error) {
      console.error("Package verification failed:", error);
      toast.error(error?.message || "Could not verify the package.");
    } finally {
      setVerifyLoading(false);
      event.target.value = "";
    }
  };

  const resetScan = () => {
    if (detectionTimerRef.current) window.clearTimeout(detectionTimerRef.current);
    detectionTimerRef.current = null;
    scanLocked.current = false;
    stopScanner();
    setCameraError("");
    setBarcodeDetected(false);
    setData("");
    setAiData(null);
    setProductName("");
    setImageFrontUrl("");
    setImageNutritionImage("");
    startScanner();
  };

  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="flex w-full flex-col items-center px-2 pt-4 sm:px-4 sm:pt-10">

      {/* =================================================
          SCANNER SECTION
      ================================================= */}

      {!aiData && (
        <div className="flex flex-col items-center w-full max-w-xl gap-6">

          {/* AUTO SCANNER */}

          <div className="w-full text-center">
            <p className="text-2xl font-semibold tracking-[-.03em] text-slate-900">
              Scan a barcode
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Point your camera at the barcode. Veronica will detect it automatically.
            </p>
          </div>

          {/* BARCODE CAMERA */}

          {cameraError && (
            <div className="w-full rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm leading-5 text-amber-800">
              <p className="font-semibold">Camera could not start</p>
              <p className="mt-1">{cameraError}</p>
              <p className="mt-2 text-xs text-amber-700">
                Allow camera access for Veronica in your browser, then press
                “Start Scanning Barcode” again.
              </p>
            </div>
          )}

          <div className={scanning
            ? "relative w-full overflow-hidden rounded-3xl border border-white/70 bg-black p-2 shadow-[0_24px_70px_rgba(20,45,35,.16)]"
            : "hidden"}>
              <div className="relative h-[380px] w-full overflow-hidden rounded-2xl bg-black">
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  autoPlay
                  className="h-full w-full object-cover"
                />

                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="relative h-40 w-[88%] max-w-lg rounded-2xl border-2 border-white/90 shadow-[0_0_0_999px_rgba(0,0,0,.32)]">
                    <span className="absolute -left-0.5 -top-0.5 h-9 w-9 rounded-tl-xl border-l-4 border-t-4 border-emerald-300" />
                    <span className="absolute -right-0.5 -top-0.5 h-9 w-9 rounded-tr-xl border-r-4 border-t-4 border-emerald-300" />
                    <span className="absolute -bottom-0.5 -left-0.5 h-9 w-9 rounded-bl-xl border-b-4 border-l-4 border-emerald-300" />
                    <span className="absolute -bottom-0.5 -right-0.5 h-9 w-9 rounded-br-xl border-b-4 border-r-4 border-emerald-300" />
                    {cameraReady && !barcodeDetected && (
                      <span className="veronica-scan-sweep absolute left-5 right-5 h-0.5 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,.95)]" />
                    )}
                  </div>
                </div>

                <div className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full border border-white/30 bg-black/60 px-5 py-2.5 text-xs font-semibold text-white backdrop-blur-md">
                  {cameraReady ? "Align the product barcode inside the frame" : "Starting camera…"}
                </div>

                {barcodeDetected && (
                  <div role="status" aria-live="polite" className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-emerald-950/60 text-white backdrop-blur-[2px]">
                    <div className="veronica-scan-detected flex h-20 w-20 items-center justify-center rounded-full border-4 border-white/80 bg-emerald-500 shadow-[0_0_44px_rgba(74,222,128,.65)]">
                      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" className="h-11 w-11">
                        <path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <p className="veronica-scan-detected text-lg font-bold tracking-wide">Barcode detected!</p>
                  </div>
                )}
              </div>
          </div>

          {scanning && !barcodeDetected && (
            <div className="flex w-full flex-col gap-3">
              {cameraReady && preferredCameraId && selectedCameraId && selectedCameraId !== preferredCameraId && (
                <button
                  type="button"
                  onClick={() => startScanner(preferredCameraId)}
                  className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900"
                >
                  Switch to main rear camera (recommended)
                </button>
              )}
              {cameraReady && availableCameras.length > 1 && (
                <details className="rounded-xl border border-gray-200 bg-white/80 px-4 py-3">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                    Change camera (optional)
                  </summary>
                  <label className="mt-3 flex flex-col gap-1 text-sm font-semibold text-slate-700">
                    Camera lens
                    <select
                      value={selectedCameraId}
                      onChange={(event) => startScanner(event.target.value)}
                      className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-slate-900"
                    >
                      <option value="">Automatic (recommended)</option>
                      {availableCameras.map((camera, index) => (
                        <option value={camera.deviceId} key={camera.deviceId || index}>
                          {camera.deviceId === preferredCameraId
                            ? `${camera.label || `Camera ${index + 1}`} — main rear (recommended)`
                            : camera.label || `Camera ${index + 1}`}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Other lenses can be too blurry for close-up barcodes. Use the recommended main rear camera when possible.
                  </p>
                </details>
              )}
              {cameraReady && (
                <p className="text-center text-xs leading-5 text-slate-500">
                  Hold the barcode steady about 15–25 cm away, in good light.
                  {availableCameras.length > 1
                    ? " The main rear camera usually focuses best at this distance."
                    : " If it stays blurry, adjust the distance or enter its numbers below."}
                </p>
              )}
              <button
                type="button"
                onClick={() => { stopScanner(); setScanning(false); }}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Stop camera
              </button>
            </div>
          )}

          {!scanning && !aiData && (
            <button
              onClick={() => {
                scanLocked.current = false;
                startScanner();
              }}
              disabled={loading}
              className="liquid-glass-button w-full px-5 py-3.5 text-base font-bold disabled:opacity-50"
            >
              Start camera scanner
            </button>
          )}

          {barcodeNotFound && !aiData && (
            <div className="w-full rounded-3xl border border-emerald-200/70 bg-emerald-50/70 p-5 text-center shadow-sm">
              <p className="text-base font-bold text-slate-900">Barcode not found</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                No product record was returned. Photograph the ingredients or nutrition label and Veronica will analyze it with Vision AI.
              </p>
              <label className="liquid-glass-button mt-4 inline-flex cursor-pointer items-center justify-center px-5 py-3 text-sm font-bold">
                {fallbackLoading ? "Analyzing label..." : "Analyze the product label"}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleVisionFallback}
                  disabled={fallbackLoading}
                />
              </label>
              <button
                type="button"
                onClick={resetScan}
                className="liquid-glass-button ml-2 mt-3 px-5 py-3 text-sm font-semibold"
              >
                Scan another barcode
              </button>
            </div>
          )}

          {/* MANUAL BARCODE INPUT */}
          <div className="w-full flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              value={data}
              onChange={(e) => setData(e.target.value.replace(/[^0-9A-Za-z_-]/g, ""))}
              placeholder="Enter barcode manually"
              className="flex-1 rounded-xl border border-gray-300 bg-white/80 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              onClick={() => handleScan(data)}
              disabled={!data || loading}
              className="liquid-glass-button px-5 font-semibold disabled:opacity-50"
            >
              {loading ? "Searching..." : "Search"}
            </button>
          </div>

          {/* SCANNED CODE */}

          {data && (
            <p className="text-gray-600 text-sm pt-2">

              Scanned Code:{" "}

              <span className="font-semibold">
                {data}
              </span>

            </p>
          )}

          {/* ANALYZE BUTTON */}

          <button
            onClick={() =>
              getResult(data)
            }
            disabled={!data || loading}
            className="liquid-glass-button w-full py-3 text-lg disabled:opacity-50"
          >
            {loading
              ? "Processing..."
              : "Analyze Ingredients"}
          </button>

        </div>
      )}

      {/* =================================================
          PRODUCT SUMMARY
      ================================================= */}

      {aiData && (
        <div className="mt-2 w-full max-w-none sm:mt-6 sm:max-w-4xl">

          <ProductSummery
            aiData={aiData}
            productName={productName}
            imageFrontUrl={imageFrontUrl}
            imageNutritionImage={imageNutritionImage}
          />

          {aiData.verification_required && (
            <div className="mx-1 mt-3 rounded-2xl border border-amber-200 bg-amber-50/90 p-3 sm:mx-auto sm:max-w-3xl">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-amber-900">
                    Some product data is still unverified
                  </p>
                  <p className="mt-1 text-[10px] leading-4 text-amber-700">
                    Photograph the ingredients, nutrition panel, or pack size from this exact package.
                  </p>
                </div>

                <label className="liquid-glass-button shrink-0 cursor-pointer px-3 py-2 text-[10px] font-bold">
                  {verifyLoading ? "Checking…" : "Scan label"}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleVerifyPackage}
                    disabled={verifyLoading}
                  />
                </label>
              </div>
            </div>
          )}

          {/* SCAN ANOTHER */}

          <div className="mt-4 flex justify-center px-1 pb-6 sm:mt-6">

            <button
              onClick={resetScan}
              className="liquid-glass-button w-full px-5 py-3 text-sm font-semibold sm:w-auto"
            >
              Scan Another Product
            </button>

          </div>

        </div>
      )}

    </div>
  );
};

export default BarcodeScanning;
