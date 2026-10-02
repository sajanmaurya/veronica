"use client";

import React, { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { toast } from "react-toastify";
import ProductSummery from "@/app/_components/ProductSummery";
import { useUserProfile } from "@/context/UserProfileContext";

const BARCODE_CACHE_DB = "veronica-barcode-cache";
const BARCODE_CACHE_STORE = "products";
const BARCODE_CACHE_TTL = 1000 * 60 * 60 * 24 * 30;

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
  const scanLocked = useRef(false);
  const readerRef = useRef(null);
  const controlsRef = useRef(null);
  const videoRef = useRef(null);

  const { profile } = useUserProfile();

  const stopScanner = () => {
    try { controlsRef.current?.stop?.(); } catch {}
    controlsRef.current = null;
    try { readerRef.current?.reset?.(); } catch {}
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
  };

  const startScanner = async () => {
    if (scanLocked.current) return;
    setCameraError("");
    setScanning(true);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera access is not supported in this browser.");
      }

      // Android phones can expose several rear lenses (main, ultra-wide,
      // telephoto). "environment" alone may select a lens that cannot focus
      // on a nearby product barcode. Request permission first, enumerate the
      // actual cameras, then prefer the primary rear camera.
      const permissionStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });
      permissionStream.getTracks().forEach((track) => track.stop());

      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      if (!devices.length) {
        throw new Error("No camera was found on this device.");
      }

      const rearCameras = devices.filter((device) => {
        const label = (device.label || "").toLowerCase();
        return (
          !/front|user|selfie/i.test(label) &&
          (/back|rear|environment|facing back/i.test(label) || devices.length === 1)
        );
      });

      // Prefer the primary/main rear lens. On Android Chrome this is commonly
      // exposed as camera 0 / facing back. Avoid ultra-wide and telephoto
      // lenses for close barcode work because their minimum focus distance
      // can be unsuitable.
      const cameraPool = rearCameras.length ? rearCameras : devices;
      const rearCamera =
        cameraPool.find((device) =>
          /camera\s*0|camera2\s*0|0,?\s*facing\s*back|main|primary|standard/i.test(
            device.label || ""
          )
        ) ||
        cameraPool.find((device) =>
          !/ultra.?wide|0\.5x|telephoto|tele|zoom/i.test(device.label || "")
        ) ||
        cameraPool[0];

      console.log(
        "Veronica camera selection:",
        cameraPool.map((device) => ({
          id: device.deviceId,
          label: device.label,
        })),
        "selected:",
        rearCamera.label
      );

      // Start the selected camera ourselves so the <video> element receives
      // the live stream before ZXing begins decoding.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          deviceId: { exact: rearCamera.deviceId },
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          frameRate: { ideal: 30, max: 30 },
        },
      });

      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error("Camera preview element is not available.");
      }

      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      video.setAttribute("autoplay", "true");
      video.muted = true;

      await new Promise((resolve, reject) => {
        const timeout = window.setTimeout(
          () => reject(new Error("Camera preview did not start.")),
          5000
        );

        const ready = () => {
          window.clearTimeout(timeout);
          video.removeEventListener("loadedmetadata", ready);
          resolve();
        };

        if (video.readyState >= 1) {
          ready();
        } else {
          video.addEventListener("loadedmetadata", ready, { once: true });
        }
      });

      await video.play();

      const track = stream.getVideoTracks()[0];
      const capabilities = track?.getCapabilities?.();

      // Prefer continuous autofocus. For browsers that expose focusDistance,
      // bias the lens toward a normal close barcode distance (~25 cm).
      if (track?.applyConstraints) {
        const advanced = [];

        if (Array.isArray(capabilities?.focusMode)) {
          if (capabilities.focusMode.includes("continuous")) {
            advanced.push({ focusMode: "continuous" });
          }
        }

        if (
          capabilities?.focusDistance &&
          Number.isFinite(capabilities.focusDistance.min) &&
          Number.isFinite(capabilities.focusDistance.max)
        ) {
          const min = Number(capabilities.focusDistance.min);
          const max = Number(capabilities.focusDistance.max);
          const target = Math.min(Math.max(0.25, min), max);
          advanced.push({ focusDistance: target });
        }

        if (advanced.length) {
          try {
            await track.applyConstraints({ advanced });
          } catch (focusError) {
            console.warn("Barcode autofocus constraints unavailable:", focusError);
          }
        }
      }

      const settings = track?.getSettings?.();
      console.log("Veronica active camera settings:", settings);

      // Veronica scans packaged-food product barcodes, so prioritize the
      // formats actually used on retail packaging. The barcode in the
      // screenshot is an EAN-13 (13 digits beginning with 890), and ZXing
      // supports EAN-13/EAN-8/UPC-A/UPC-E directly.
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);

      const reader = new BrowserMultiFormatReader(hints);
      readerRef.current = reader;

      const controls = await reader.decodeFromVideoElement(
        video,
        (result) => {
          if (result && !scanLocked.current) {
            const value = String(result.getText?.() || "").trim();
            if (value) handleScan(value);
          }
        }
      );

      controlsRef.current = {
        stop: () => {
          try {
            controls?.stop?.();
          } catch {}
          stream.getTracks().forEach((track) => track.stop());
          if (video.srcObject === stream) video.srcObject = null;
        },
      };

      setCameraReady(true);
    } catch (error) {
      console.error("ZXing scanner startup failed:", error);
      stopScanner();
      setScanning(false);
      setCameraError(
        error?.name === "NotAllowedError"
          ? "Camera permission was denied. Allow camera access for Veronica and try again."
          : error?.message || "Unable to start the barcode scanner."
      );
    }
  };

  useEffect(() => {
    scanLocked.current = false;
    startScanner();
    return () => stopScanner();
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

  const handleScan = (barcode) => {
    const cleanBarcode = String(barcode || "").trim();
    if (!cleanBarcode || scanLocked.current || loading) return;

    scanLocked.current = true;
    setData(cleanBarcode);
    stopScanner();
    setScanning(false);

    getResult(cleanBarcode);
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
      }

      console.log("Barcode API Response:", response);

      if (!response.success || !response.data) {
        setBarcodeNotFound(true);
        toast.info("Product not in the barcode database. You can scan its label instead.");
        return;
      }

      await cacheBarcode(cleanBarcode, response.data);

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

      toast.error(
        "Something went wrong while fetching product"
      );
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
                rating: scan.rating,
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
            quantitySource === "unavailable",
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
    scanLocked.current = false;
    stopScanner();
    setCameraError("");
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

          {scanning && (
            <div className="relative w-full overflow-hidden rounded-3xl border border-white/70 bg-black p-2 shadow-[0_24px_70px_rgba(20,45,35,.16)]">
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
                    <span className="absolute left-5 right-5 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,.95)]" />
                  </div>
                </div>

                <div className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full border border-white/30 bg-black/60 px-5 py-2.5 text-xs font-semibold text-white backdrop-blur-md">
                  Align the product barcode inside the frame
                </div>
              </div>
            </div>
          )}

          {!scanning && !aiData && (
            <button
              onClick={() => {
                scanLocked.current = false;
                startScanner();
              }}
              disabled={loading}
              className="w-full rounded-2xl bg-emerald-600 px-5 py-3.5 text-base font-bold text-white shadow-lg transition hover:bg-emerald-700 disabled:opacity-50"
            >
              Scan with camera
            </button>
          )}

          {barcodeNotFound && !aiData && (
            <div className="w-full rounded-3xl border border-emerald-200/70 bg-emerald-50/70 p-5 text-center shadow-sm">
              <p className="text-base font-bold text-slate-900">Barcode not found</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                No product record was returned. Photograph the ingredients or nutrition label and Veronica will analyze it with Vision AI.
              </p>
              <label className="mt-4 inline-flex cursor-pointer items-center justify-center rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-emerald-800">
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
                className="ml-2 mt-3 rounded-2xl border border-emerald-900/10 bg-white/70 px-5 py-3 text-sm font-semibold text-emerald-800"
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
              className="rounded-xl bg-emerald-600 px-5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
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
            className="w-full bg-green-600 text-white text-lg py-3 rounded-lg hover:bg-green-700 transition-all disabled:opacity-50"
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

                <label className="shrink-0 cursor-pointer rounded-xl bg-amber-900 px-3 py-2 text-[10px] font-bold text-white">
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
              className="w-full rounded-2xl bg-slate-800 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-900 sm:w-auto"
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