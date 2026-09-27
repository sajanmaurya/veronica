"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

export default function ProductSummary({ aiData, productName, imageFrontUrl, imageNutritionImage }) {
  const { user } = useUser();
  const [error, setError] = useState(null);

  useEffect(() => {
    async function saveSearch() {
      if (!user || !aiData) return;
      try {
        const res = await fetch("/api/previousSearches/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productName: productName || "Image label analysis", imageFrontUrl, imageNutritionImage, aiData }),
        });
        if (!res.ok) {
          const responseText = await res.text();
          let message = "Failed to save search";
          try {
            message = JSON.parse(responseText).error || message;
          } catch {
            console.error("Unexpected history API response:", responseText);
          }
          throw new Error(message);
        }
        setError(null);
      } catch (err) {
        setError(err.message);
      }
    }
    saveSearch();
  }, [aiData, imageFrontUrl, imageNutritionImage, productName, user]);

  if (!aiData) return null;
  const rating = Number(aiData.rating) || 0;

  return (
    <section className="app-canvas pt-6">
      <div className="mx-auto max-w-4xl">
        <div className="glass-panel p-5 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div><p className="eyebrow">Analysis complete</p><h1 className="mt-4 text-3xl font-semibold tracking-[-.04em] text-slate-900">{productName || "Product summary"}</h1><p className="mt-2 text-sm text-slate-600">A practical look at what is inside.</p></div>
            <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-full bg-emerald-700 text-white shadow-lg shadow-emerald-900/20"><span className="text-3xl font-semibold">{rating}</span><span className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">out of 10</span></div>
          </div>
          {(imageFrontUrl || imageNutritionImage) && <div className="mt-7 flex flex-wrap gap-3">{[imageFrontUrl, imageNutritionImage].filter(Boolean).map((src, index) => <img key={src} src={src} alt={index ? "Nutrition label" : "Product"} className="h-32 w-32 rounded-2xl border border-white/70 bg-white/50 object-contain p-2" />)}</div>}
          <div className="mt-8 grid gap-5">
            <div className="rounded-2xl bg-white/45 p-5"><h2 className="text-sm font-bold uppercase tracking-[.13em] text-slate-500">Verdict</h2><p className="mt-3 leading-7 text-slate-700">{aiData.summary}</p></div>
            <div className="rounded-2xl bg-rose-50/55 p-5"><h2 className="text-sm font-bold uppercase tracking-[.13em] text-rose-700">Ingredients to note</h2>{aiData.harmful_ingredients?.length ? <ul className="mt-3 space-y-3">{aiData.harmful_ingredients.map((item, index) => <li key={index} className="border-l-2 border-rose-400 pl-4 text-sm leading-6 text-slate-700"><strong className="font-semibold text-slate-900">{item.name}</strong><br />{item.impact}</li>)}</ul> : <p className="mt-3 text-sm text-emerald-700">No significant concerns were identified.</p>}</div>
            {aiData.user_specific_summary?.trim() && <div className="rounded-2xl bg-violet-50/55 p-5"><h2 className="text-sm font-bold uppercase tracking-[.13em] text-violet-700">For your profile</h2><p className="mt-3 leading-7 text-slate-700">{aiData.user_specific_summary}</p></div>}
          </div>
          {error && <p className="mt-5 text-sm text-rose-700">Could not save this result: {error}</p>}
        </div>
      </div>
    </section>
  );
}