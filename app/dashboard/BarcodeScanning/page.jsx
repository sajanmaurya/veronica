"use client";

import React, { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { chatSession, getGeminiFallbackResponse, isModelUnavailableError, isQuotaError, normalizeGeminiJson } from "../../utils/GeminiAiModal";
import ProductSummery from "@/app/_components/ProductSummery";
import { useUserProfile } from "@/context/UserProfileContext";

const BarcodeScanning = () => {
  const [scanning, setScanning] = useState(false);
  const [data, setData] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiData, setAiData] = useState(null);
  const [cameraError, setCameraError] = useState("");
  const [stopStream, setStopStream] = useState(true);
  const scanLocked = useRef(false);
  const scannerRef = useRef(null);
  const scannerElementId = "veronica-barcode-reader";

  const { profile } = useUserProfile();

  const loadScannerLibrary = () =>
    new Promise((resolve, reject) => {
      if (window.Html5Qrcode) {
        resolve(window.Html5Qrcode);
        return;
      }

      const existing = document.querySelector(
        'script[data-veronica-html5-qrcode="true"]'
      );

      if (existing) {
        existing.addEventListener("load", () => resolve(window.Html5Qrcode), {
          once: true,
        });
        existing.addEventListener("error", reject, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js";
      script.async = true;
      script.dataset.veronicaHtml5Qrcode = "true";
      script.onload = () => resolve(window.Html5Qrcode);
      script.onerror = () =>
        reject(new Error("Barcode scanner library could not be loaded."));
      document.head.appendChild(script);
    });

  useEffect(() => {
    let cancelled = false;

    const startScanner = async () => {
      try {
        setCameraError("");

        const Html5Qrcode = await loadScannerLibrary();
        if (cancelled || !Html5Qrcode) return;

        const cameras = await Html5Qrcode.getCameras();

        if (!cameras?.length) {
          throw new Error("No camera was found on this device.");
        }

        // Explicitly choose the physical rear camera. Using only
        // facingMode=environment can select an ultrawide/wide rear camera
        // on some Android phones, which can remain blurry at barcode distance.
        const rearCamera =
          cameras.find((camera) =>
            /back|rear|environment|world|main/i.test(camera.label || "")
          ) || cameras[cameras.length - 1];

        const scanner = new Html5Qrcode(scannerElementId, {
          verbose: false,
          formatsToSupport: [
            0, 2, 3, 5, 8, 9, 10, 14, 15
          ],
          useBarCodeDetectorIfSupported: true,
        });

        scannerRef.current = scanner;

        await scanner.start(
          { deviceId: { exact: rearCamera.id } },
          {
            fps: 10,
            aspectRatio: 16 / 9,
            disableFlip: true,
            qrbox: (width, height) => ({
              width: Math.min(Math.floor(width * 0.92), 520),
              height: Math.min(Math.floor(height * 0.42), 190),
            }),
          },
          (decodedText) => {
            if (!decodedText || scanLocked.current) return;
            handleScan(null, { text: decodedText });
          },
          () => {}
        );

        if (cancelled) return;

        setStopStream(false);

        // Apply focus/zoom to the already-running camera track.
        // html5-qrcode exposes these controls specifically for its active
        // MediaStreamTrack.
        try {
          const capabilities = scanner.getRunningTrackCapabilities?.();

          if (capabilities?.focusMode?.includes?.("continuous")) {
            await scanner.applyVideoConstraints({
              advanced: [{ focusMode: "continuous" }],
            });
          }

          if (capabilities?.zoom) {
            const minZoom = Number(capabilities.zoom.min ?? 1);
            const maxZoom = Number(capabilities.zoom.max ?? minZoom);
            const preferredZoom = Math.min(
              Math.max(minZoom, 1.2),
              maxZoom
            );

            if (preferredZoom > minZoom) {
              await scanner.applyVideoConstraints({
                advanced: [{ zoom: preferredZoom }],
              });
            }
          }
        } catch (cameraControlError) {
          console.debug(
            "Camera focus/zoom controls unavailable:",
            cameraControlError
          );
        }
      } catch (error) {
        console.error("Barcode scanner startup failed:", error);

        if (!cancelled) {
          setCameraError(
            error?.name === "NotAllowedError"
              ? "Camera permission was denied. Allow camera access for Veronica and reload the page."
              : error?.message || "Unable to start the barcode scanner."
          );
          setScanning(false);
        }
      }
    };

    startScanner();

    return () => {
      cancelled = true;

      const scanner = scannerRef.current;
      scannerRef.current = null;

      if (scanner) {
        scanner
          .stop()
          .catch(() => {})
          .finally(() => {
            try {
              scanner.clear();
            } catch {}
          });
      }
    };
  }, []);

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

    // Stop the camera stream before unmounting the scanner.
    // This avoids the react-webcam freeze that can occur when the
    // scanner component is removed immediately after a successful scan.
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
                Check camera permission and reload Veronica if necessary.
              </p>
            </div>
          )}

          <div className="relative w-full overflow-hidden rounded-3xl border border-white/70 bg-black p-2 shadow-[0_24px_70px_rgba(20,45,35,.16)]">
            <div
              id={scannerElementId}
              className="relative w-full overflow-hidden rounded-2xl bg-black"
            />

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