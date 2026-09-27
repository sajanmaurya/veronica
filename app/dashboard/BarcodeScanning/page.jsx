"use client";

import React, { useEffect, useRef, useState } from "react";
import BarcodeScannerComponent from "react-qr-barcode-scanner";
import { toast } from "react-toastify";
import { chatSession, getGeminiFallbackResponse, isModelUnavailableError, isQuotaError, normalizeGeminiJson } from "../../utils/GeminiAiModal";
import ProductSummery from "@/app/_components/ProductSummery";
import { useUserProfile } from "@/context/UserProfileContext";

const BarcodeScanning = () => {
  const [scanning, setScanning] = useState(true);
  const [data, setData] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiData, setAiData] = useState(null);
  const [cameraError, setCameraError] = useState("");
  const [useLibraryFallback, setUseLibraryFallback] = useState(false);
  const [stopStream, setStopStream] = useState(true);
  const scanLocked = useRef(false);
  const nativeVideoRef = useRef(null);
  const nativeStreamRef = useRef(null);
  const detectorTimerRef = useRef(null);
  const nativeDetectorActive = useRef(false);

  const { profile } = useUserProfile();

  useEffect(() => {
    // Start immediately, like a payment/barcode scanner.
    scanLocked.current = false;
    setCameraError("");
    setUseLibraryFallback(false);
    setScanning(true);

    return () => {
      nativeDetectorActive.current = false;
      if (detectorTimerRef.current) clearTimeout(detectorTimerRef.current);
      nativeStreamRef.current?.getTracks?.().forEach((track) => track.stop());
      nativeStreamRef.current = null;
    };
  }, []);

  const stopNativeCamera = () => {
    nativeDetectorActive.current = false;
    if (detectorTimerRef.current) {
      clearTimeout(detectorTimerRef.current);
      detectorTimerRef.current = null;
    }
    nativeStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    nativeStreamRef.current = null;
  };

  const startNativeScanner = async () => {
    try {
      setCameraError("");

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera API is not supported in this browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      nativeStreamRef.current = stream;

      const track = stream.getVideoTracks()[0];
      const capabilities = track?.getCapabilities?.();

      // Apply focus only after the camera is live. Do not put focusMode
      // in getUserMedia's initial constraints because some Android
      // camera drivers handle that constraint poorly.
      if (track?.applyConstraints && capabilities?.focusMode?.includes?.("continuous")) {
        try {
          await track.applyConstraints({
            advanced: [{ focusMode: "continuous" }],
          });
        } catch (focusError) {
          console.debug("Continuous autofocus unavailable:", focusError);
        }
      }

      // A modest optical/digital zoom can make a product barcode large
      // enough for reliable decoding when the device exposes zoom.
      if (track?.applyConstraints && capabilities?.zoom) {
        try {
          const zoom = Math.min(
            Math.max(capabilities.zoom.min || 1, 1.15),
            capabilities.zoom.max || 1.15
          );
          await track.applyConstraints({
            advanced: [{ zoom }],
          });
        } catch (zoomError) {
          console.debug("Camera zoom unavailable:", zoomError);
        }
      }

      const video = nativeVideoRef.current;
      if (!video) return;

      video.srcObject = stream;
      await video.play();

      if (!("BarcodeDetector" in window)) {
        // Native detection is unavailable in this browser. Stop the native
        // stream before handing camera ownership to the ZXing fallback.
        console.log("Native BarcodeDetector unavailable; using ZXing fallback.");
        stopNativeCamera();
        setUseLibraryFallback(true);
        return;
      }

      const supported = await window.BarcodeDetector.getSupportedFormats();
      const preferredFormats = [
        "ean_13",
        "ean_8",
        "upc_a",
        "upc_e",
        "code_128",
        "code_39",
        "itf",
        "codabar",
        "qr_code",
      ];
      const formats = preferredFormats.filter((format) => supported.includes(format));

      if (!formats.length) return;

      const detector = new window.BarcodeDetector({ formats });
      nativeDetectorActive.current = true;

      const detect = async () => {
        if (!nativeDetectorActive.current || !nativeVideoRef.current) return;

        try {
          const results = await detector.detect(nativeVideoRef.current);

          if (results?.length) {
            const value = String(results[0].rawValue || "").trim();
            if (value && !scanLocked.current) {
              handleScan(null, { text: value });
              return;
            }
          }
        } catch (error) {
          console.debug("Barcode detection frame skipped:", error);
        }

        detectorTimerRef.current = setTimeout(detect, 100);
      };

      detect();
    } catch (error) {
      console.error("Native camera error:", error);
      setCameraError(
        error?.name === "NotAllowedError"
          ? "Camera permission was denied. Allow camera access and reload Veronica."
          : error?.name === "NotFoundError"
            ? "No camera was found on this device."
            : "Unable to start the camera. Please check browser camera permissions."
      );
      setScanning(false);
    }
  };

  useEffect(() => {
    if (!scanning) {
      stopNativeCamera();
      return;
    }

    startNativeScanner();

    return () => stopNativeCamera();
  }, [scanning]);

  const [imageFrontUrl, setImageFrontUrl] = useState("");
  const [imageNutritionImage, setImageNutritionImage] = useState("");
  const [productName, setProductName] = useState("");

  // =====================================================
  // BARCODE SCANNER
  // =====================================================

  const handleScan = (err, result) => {
    // No barcode detected is normal.
    // Do not show it as an application error.

    if (!result || !result.text) {
      return;
    }

    const barcode = String(result.text).trim();

    if (!barcode) {
      return;
    }

    if (scanLocked.current || loading) {
      return;
    }

    scanLocked.current = true;
    console.log("Barcode Scanned:", barcode);

    // Stop the active camera immediately after a successful decode.
    // This gives the same instant-capture behavior as payment apps.
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (scanner) {
      scanner.stop().catch(() => {}).finally(() => {
        try {
          scanner.clear();
        } catch {}
      });
    }

    setStopStream(true);
    setScanning(false);

    // Store barcode
    setData(barcode);

    // Get product
    getResult(barcode);
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

      const result = await fetch(
        `/api/scanBarcode/${encodeURIComponent(cleanBarcode)}`
      );

      const response = await result.json();

      console.log("Barcode API Response:", response);

      if (!response.success || !response.data) {
        toast.error(response.message || "Product not found");
        return;
      }

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

      // Send product to Gemini
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

      if (!chatSession) {
        const fallback = getGeminiFallbackResponse("Gemini API key is missing. Add NEXT_PUBLIC_GEMINI_KEY to .env.local.");
        setAiData(fallback);
        toast.error("Gemini API key is missing. Add NEXT_PUBLIC_GEMINI_KEY to .env.local.");
        return;
      }

      const InputPrompt = `
You are a highly experienced nutritionist and food safety analyst.

Evaluate the given food product based on its nutritional content, ingredients, and potential health impact.

IMPORTANT:
Give a practical food-safety and nutrition assessment.
Do not claim to diagnose or treat diseases.

### 1. HEALTH RATING

Give a health rating from 1 to 10.

- 1-3 = Very unhealthy
- 4-6 = Moderately healthy
- 7-10 = Healthy

Consider:

- Sugar
- Saturated fat
- Sodium/salt
- Protein
- Fiber
- Calories
- Ingredients
- Additives
- Processing level
- Overall nutritional quality

### 2. HARMFUL INGREDIENTS

Identify potentially concerning ingredients or nutritional values such as:

- Excess sugar above 10g per 100g
- Saturated fat above 5g per 100g
- High sodium
- Trans fats
- Artificial additives
- Preservatives
- Allergens
- Other concerning ingredients

For each one, explain its possible health impact.

If there are no significant harmful ingredients, return an empty array.

### 3. GENERAL SUMMARY

Give a concise summary.

Mention whether the product is best:

- Frequently consumed
- Occasionally consumed
- Better avoided

Suggest healthier alternatives when appropriate.

### 4. USER-SPECIFIC SUMMARY

Use the user's diseases and allergies if they are available.

Explain whether the product appears:

- Safe
- Risky
- Should be avoided

Do not make a medical diagnosis.

If no user-specific information is available, return an empty string.

### PRODUCT DATA

${productData}

### USER HEALTH PROFILE

${JSON.stringify({
  diseases: profile?.diseases || null,
  allergies: profile?.allergies || null,
})}

### RETURN ONLY VALID JSON

{
  "rating": 1,
  "harmful_ingredients": [
    {
      "name": "Ingredient Name",
      "impact": "Explanation of possible health concern"
    }
  ],
  "summary": "General analysis and recommendation",
  "user_specific_summary": "Personalized analysis based on diseases or allergies"
}

Do not return markdown.
Do not return \`\`\`json.
Return only the JSON object.
`;

      const result = await chatSession.sendMessage(InputPrompt);

      let aiText =
        result.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "";

      console.log("AI Raw Response:", aiText);

      const parsedAiData = normalizeGeminiJson(aiText) || getGeminiFallbackResponse("AI returned a blank or invalid response. Please try again.");

      console.log("Parsed AI Analysis:", parsedAiData);

      setAiData(parsedAiData);

      try {
        const saveResponse = await fetch(
          "/api/previousSearches/products",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              productName:
                currentProductName || "Unknown Product",

              imageFrontUrl:
                currentImageFrontUrl || null,

              imageNutritionImage:
                currentImageNutritionImage || null,

              aiData: parsedAiData,
            }),
          }
        );

        const saveData = await saveResponse.json();

        console.log(
          "Save Previous Search Response:",
          saveData
        );

        if (saveResponse.ok) {
          console.log(
            "Product search saved successfully."
          );
        } else if (saveResponse.status === 401) {
          console.warn(
            "User is not authenticated. Previous search was not saved."
          );
        } else {
          console.error(
            "Failed to save previous search:",
            saveData
          );
        }
      } catch (saveError) {
        console.error(
          "Error saving previous search:",
          saveError
        );
      }

      toast.success(
        "Product analysis completed!"
      );

    } catch (error) {
      console.error(
        "Error analyzing product:",
        error
      );

      if (isModelUnavailableError(error)) {
        const fallback = getGeminiFallbackResponse("The configured Gemini model is no longer available. Please update the app to a supported Google model.");
        setAiData(fallback);
        toast.warn(
          "The connected Gemini model is no longer available. Please update the app configuration."
        );
        return;
      }

      if (isQuotaError(error)) {
        const fallback = getGeminiFallbackResponse();
        setAiData(fallback);
        toast.warn(
          "AI product analysis is temporarily unavailable because the Gemini quota limit has been reached. Please try again later or update your billing plan."
        );
        return;
      }

      toast.error(
        "Something went wrong while analyzing the product."
      );
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // RESET
  // =====================================================

  const resetScan = () => {
    scanLocked.current = false;
    setStopStream(true);
    stopNativeCamera();
    setScanning(false);
    setCameraError("");
    setData("");
    setAiData(null);

    setProductName("");
    setImageFrontUrl("");
    setImageNutritionImage("");
  };

  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="flex flex-col items-center w-full mt-12 px-4">

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
              <div className="relative h-[360px] w-full overflow-hidden rounded-2xl bg-black">
                {!useLibraryFallback && (
                  <video
                    ref={nativeVideoRef}
                    muted
                    playsInline
                    autoPlay
                    className="h-full w-full object-contain"
                  />
                )}

                {useLibraryFallback && (
                  <div className="absolute inset-0">
                    <BarcodeScannerComponent
                      onUpdate={handleScan}
                      onError={(error) => {
                        console.error("Barcode scanner error:", error);
                        setCameraError("Unable to decode the barcode with this browser. Try Chrome on Android or enter the barcode manually.");
                      }}
                      videoConstraints={{
                        facingMode: { ideal: "environment" },
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                      }}
                      stopStream={stopStream}
                      width="100%"
                      height={360}
                      delay={150}
                    />
                  </div>
                )}

                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="relative h-36 w-[82%] max-w-md rounded-2xl border-2 border-white/90 shadow-[0_0_0_999px_rgba(0,0,0,.28)]">
                    <span className="absolute -left-0.5 -top-0.5 h-8 w-8 rounded-tl-xl border-l-4 border-t-4 border-emerald-300" />
                    <span className="absolute -right-0.5 -top-0.5 h-8 w-8 rounded-tr-xl border-r-4 border-t-4 border-emerald-300" />
                    <span className="absolute -bottom-0.5 -left-0.5 h-8 w-8 rounded-bl-xl border-b-4 border-l-4 border-emerald-300" />
                    <span className="absolute -bottom-0.5 -right-0.5 h-8 w-8 rounded-br-xl border-b-4 border-r-4 border-emerald-300" />
                    <span className="absolute left-4 right-4 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-emerald-300/90 shadow-[0_0_14px_rgba(110,231,183,.95)]" />
                  </div>
                </div>

                <div className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full border border-white/30 bg-black/55 px-5 py-2.5 text-xs font-semibold text-white backdrop-blur-md">
                  Point the barcode inside the frame
                </div>
              </div>
            </div>
          )}

          {/* MANUAL BARCODE INPUT */}

          <div className="w-full flex gap-2">

            <input
              type="text"
              value={data}
              onChange={(e) =>
                setData(e.target.value)
              }
              placeholder="Enter barcode manually"
              className="flex-1 border border-gray-300 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-green-500"
            />

            <button
              onClick={() => getResult(data)}
              disabled={!data || loading}
              className="bg-green-600 text-white px-5 rounded-lg hover:bg-green-700 transition-all disabled:opacity-50"
            >
              {loading
                ? "Searching..."
                : "Search"}
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
        <div className="w-full max-w-4xl mt-10">

          <ProductSummery
            aiData={aiData}
            productName={productName}
            imageFrontUrl={imageFrontUrl}
            imageNutritionImage={
              imageNutritionImage
            }
          />

          {/* SCAN ANOTHER */}

          <div className="flex justify-center mt-8">

            <button
              onClick={resetScan}
              className="bg-gray-700 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-all"
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