"use client";

import React, { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { toast } from "react-toastify";
import ProductSummery from "@/app/_components/ProductSummery";
import { useUserProfile } from "@/context/UserProfileContext";

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

      // Request permission first so camera labels are available when we
      // choose the rear-facing camera on phones.
      const permissionStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });
      permissionStream.getTracks().forEach((track) => track.stop());

      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      if (!devices.length) {
        throw new Error("No camera was found on this device.");
      }

      const rearCamera =
        devices.find((device) =>
          /back|rear|environment|world|main/i.test(device.label || "")
        ) || devices[devices.length - 1];

      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      const controls = await reader.decodeFromVideoDevice(
        rearCamera.deviceId,
        videoRef.current,
        (result, error) => {
          if (result && !scanLocked.current) {
            const value = String(result.getText?.() || "").trim();
            if (value) handleScan(value);
          }
        }
      );

      controlsRef.current = controls;
      setCameraReady(true);

      const track = videoRef.current?.srcObject?.getVideoTracks?.()[0];
      const capabilities = track?.getCapabilities?.();

      if (track?.applyConstraints && capabilities?.focusMode?.includes?.("continuous")) {
        try {
          await track.applyConstraints({ advanced: [{ focusMode: "continuous" }] });
        } catch {}
      }

      if (track?.applyConstraints && capabilities?.zoom) {
        try {
          const min = Number(capabilities.zoom.min ?? 1);
          const max = Number(capabilities.zoom.max ?? min);
          const zoom = Math.min(Math.max(min, 1.15), max);
          await track.applyConstraints({ advanced: [{ zoom }] });
        } catch {}
      }
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

      const response = await fetch("/api/analyzeBarcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: JSON.parse(productData),
          profile: {
            diseases: profile?.diseases || "",
            allergies: profile?.allergies || "",
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