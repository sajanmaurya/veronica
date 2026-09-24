"use client";
import React from "react";
import { useRouter } from "next/navigation";

const Dashboard = () => {
  const router = useRouter();

  const handleRedirectScan = () => {
    router.push("/dashboard/BarcodeScanning");
  };

  const handleRedirectImage = () => {
    router.push("/dashboard/ImageUpload");
  };

  return (
    <div className="min-h-[calc(100vh-88px)] bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),_transparent_30%),linear-gradient(135deg,#f8fffb_0%,#f5f7fb_40%,#eef4ff_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="w-full max-w-xl lg:w-1/2">
          <div className="mb-5 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
            Smart nutrition assistant
          </div>

          <h1 className="text-4xl font-black leading-tight text-slate-900 sm:text-5xl lg:text-6xl">
            Your Food,
            <span className="block bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
              Decoded
            </span>
          </h1>

          <p className="mt-5 max-w-lg text-base leading-7 text-slate-600 sm:text-lg">
            Scan barcodes or upload ingredient labels to understand what you are eating and make healthier choices with confidence.
          </p>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <button
              onClick={handleRedirectScan}
              className="rounded-full bg-gradient-to-r from-emerald-600 to-green-500 px-6 py-4 text-base font-semibold text-white shadow-[0_15px_35px_rgba(16,185,129,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(16,185,129,0.4)]"
            >
              Instant Scan (Barcode)
            </button>

            <button
              onClick={handleRedirectImage}
              className="rounded-full border border-slate-200 bg-white px-6 py-4 text-base font-semibold text-slate-700 shadow-[0_10px_25px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:border-emerald-200 hover:text-emerald-700"
            >
              Upload Ingredient Label
            </button>
          </div>
        </div>

        <div className="relative w-full max-w-xl lg:w-1/2">
          <div className="absolute -left-10 top-10 h-32 w-32 rounded-full bg-emerald-300/30 blur-3xl" />
          <div className="absolute -right-4 bottom-10 h-40 w-40 rounded-full bg-blue-300/30 blur-3xl" />

          <div className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/70 p-3 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur-sm">
            <img
              src="/back.png"
              alt="Healthy food analysis"
              className="h-auto w-full rounded-[1.5rem] object-cover"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;


