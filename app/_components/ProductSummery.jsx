"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useUserProfile } from "@/context/UserProfileContext";

async function makePermanentImageData(sourceUrl) {
  if (!sourceUrl) return null;
  if (sourceUrl.startsWith("data:")) return sourceUrl;
  if (!sourceUrl.startsWith("blob:")) return null;

  try {
    const response = await fetch(sourceUrl);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const maxSize = 1200;
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return null;
    }

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return canvas.toDataURL("image/webp", 0.78);
  } catch (error) {
    console.error("Could not prepare history image:", error);
    return null;
  }
}

async function uploadHistoryImage(imageData, folder) {
  if (!imageData) return null;
  if (imageData.startsWith("https://")) return imageData;

  const response = await fetch("/api/storage/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageData, folder }),
  });

  const data = await response.json();

  if (!response.ok) {
    const diagnostic = data?.details
      ? [
          data.details.name,
          data.details.code,
          data.details.httpStatusCode
            ? `HTTP ${data.details.httpStatusCode}`
            : null,
          data.details.message,
        ]
          .filter(Boolean)
          .join(": ")
      : null;

    throw new Error(
      diagnostic || data?.error || "Failed to upload history image"
    );
  }

  if (!data?.url) {
    throw new Error("Image upload succeeded but no image URL was returned.");
  }

  return data.url;
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getNutrientStatus(key, value) {
  const number = finiteNumber(value);
  if (number == null) return { label: "Unknown", tone: "slate", progress: 0 };

  const rules = {
    added_sugar_g: [
      [5, "Low", "emerald", 30],
      [10, "Moderate", "amber", 60],
      [Infinity, "High", "rose", 92],
    ],
    total_sugar_g: [
      [5, "Low", "emerald", 30],
      [15, "Moderate", "amber", 60],
      [Infinity, "High", "rose", 92],
    ],
    saturated_fat_g: [
      [1.5, "Low", "emerald", 30],
      [5, "Moderate", "amber", 60],
      [Infinity, "High", "rose", 92],
    ],
    sodium_mg: [
      [140, "Low", "emerald", 30],
      [400, "Moderate", "amber", 60],
      [Infinity, "High", "rose", 92],
    ],
    fiber_g: [
      [2, "Low", "rose", 30],
      [5, "Moderate", "amber", 60],
      [Infinity, "Good", "emerald", 90],
    ],
    protein_g: [
      [5, "Low", "slate", 30],
      [10, "Moderate", "amber", 60],
      [Infinity, "Good", "emerald", 90],
    ],
  };

  const selected = rules[key]?.find(([limit]) => number <= limit);
  if (!selected) return { label: "Available", tone: "slate", progress: 50 };

  return {
    label: selected[1],
    tone: selected[2],
    progress: selected[3],
  };
}

const toneClasses = {
  emerald: {
    badge: "bg-emerald-100 text-emerald-800",
    bar: "bg-emerald-500",
  },
  amber: {
    badge: "bg-amber-100 text-amber-800",
    bar: "bg-amber-500",
  },
  rose: {
    badge: "bg-rose-100 text-rose-800",
    bar: "bg-rose-500",
  },
  slate: {
    badge: "bg-slate-100 text-slate-700",
    bar: "bg-slate-400",
  },
};

function NutrientCard({ label, nutrientKey, value, unit }) {
  const status = getNutrientStatus(nutrientKey, value);
  const tone = toneClasses[status.tone] || toneClasses.slate;

  return (
    <div className="rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
            {value != null ? value : "—"}
            {value != null && (
              <span className="ml-1 text-xs font-semibold text-slate-400">
                {unit}
              </span>
            )}
          </p>
        </div>

        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${tone.badge}`}>
          {status.label}
        </span>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${tone.bar}`}
          style={{ width: `${status.progress}%` }}
        />
      </div>
    </div>
  );
}

function buildScoreReasons(aiData) {
  const nutrition = aiData?.nutrition || {};
  const reasons = [];

  const sugar = finiteNumber(
    nutrition.added_sugar_g ?? nutrition.total_sugar_g
  );
  const sodium = finiteNumber(nutrition.sodium_mg);
  const saturatedFat = finiteNumber(nutrition.saturated_fat_g);
  const protein = finiteNumber(nutrition.protein_g);
  const fiber = finiteNumber(nutrition.fiber_g);

  if (protein != null) {
    if (protein >= 10) reasons.push({ type: "positive", title: "Good protein", detail: `${protein} g per listed serving` });
    else if (protein < 5) reasons.push({ type: "neutral", title: "Low protein", detail: `${protein} g per listed serving` });
  }

  if (fiber != null) {
    if (fiber >= 5) reasons.push({ type: "positive", title: "Good fiber", detail: `${fiber} g per listed serving` });
    else if (fiber < 2) reasons.push({ type: "neutral", title: "Low fiber", detail: `${fiber} g per listed serving` });
  }

  if (sugar != null) {
    if (sugar >= 10) reasons.push({ type: "negative", title: "High sugar", detail: `${sugar} g per listed serving` });
    else if (sugar <= 5) reasons.push({ type: "positive", title: "Lower sugar", detail: `${sugar} g per listed serving` });
  }

  if (sodium != null) {
    if (sodium >= 400) reasons.push({ type: "negative", title: "High sodium", detail: `${sodium} mg per listed serving` });
    else if (sodium <= 140) reasons.push({ type: "positive", title: "Lower sodium", detail: `${sodium} mg per listed serving` });
    else reasons.push({ type: "neutral", title: "Moderate sodium", detail: `${sodium} mg per listed serving` });
  }

  if (saturatedFat != null) {
    if (saturatedFat >= 5) reasons.push({ type: "negative", title: "High saturated fat", detail: `${saturatedFat} g per listed serving` });
    else if (saturatedFat <= 1.5) reasons.push({ type: "positive", title: "Low saturated fat", detail: `${saturatedFat} g per listed serving` });
  }

  if (Array.isArray(aiData?.harmful_ingredients) && aiData.harmful_ingredients.length) {
    reasons.push({
      type: "neutral",
      title: "Ingredients to review",
      detail: `${aiData.harmful_ingredients.length} notable item${aiData.harmful_ingredients.length === 1 ? "" : "s"} detected`,
    });
  }

  return reasons.slice(0, 5);
}

function confidenceFromValidation(validation, ingredientsCount) {
  if (validation?.status === "verified") {
    return {
      label: "High confidence",
      tone: "emerald",
      description:
        validation.message || "Nutrition values passed basic consistency checks.",
    };
  }

  if (validation?.status === "needs_verification") {
    return {
      label: "Needs verification",
      tone: "amber",
      description:
        validation.message ||
        "Some values should be checked against the package label.",
    };
  }

  return {
    label: ingredientsCount > 0 ? "Moderate confidence" : "Limited confidence",
    tone: ingredientsCount > 0 ? "amber" : "slate",
    description:
      "Veronica could not fully verify the extracted label data.",
  };
}

export default function ProductSummary({
  aiData,
  productName,
  imageFrontUrl,
  imageNutritionImage,
}) {
  const { user } = useUser();
  const { profile } = useUserProfile();
  const [error, setError] = useState(null);
  const [alternatives, setAlternatives] = useState([]);
  const [alternativesLoading, setAlternativesLoading] = useState(false);
  const [alternativesMessage, setAlternativesMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadAlternatives() {
      if (!aiData) return;

      setAlternatives([]);
      setAlternativesMessage("");
      setAlternativesLoading(true);

      try {
        const response = await fetch("/api/alternatives", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            product: aiData,
            profile: {
              allergies: profile?.allergies || "",
              dietaryPreferences: profile?.dietaryPreferences || "",
            },
          }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Could not find alternatives.");
        }

        if (!cancelled) {
          setAlternatives(result.data?.alternatives || []);
          setAlternativesMessage(result.data?.message || "");
        }
      } catch (alternativeError) {
        console.error("Could not load healthy alternatives:", alternativeError);
        if (!cancelled) {
          setAlternativesMessage("Alternatives are unavailable right now.");
        }
      } finally {
        if (!cancelled) setAlternativesLoading(false);
      }
    }

    loadAlternatives();

    return () => {
      cancelled = true;
    };
  }, [aiData, profile?.allergies, profile?.dietaryPreferences]);

  useEffect(() => {
    let cancelled = false;

    async function saveSearch() {
      if (!user || !aiData) return;

      try {
        const frontImageData = await makePermanentImageData(imageFrontUrl);
        const nutritionImageData = await makePermanentImageData(
          imageNutritionImage
        );

        if (cancelled) return;

        const [permanentFrontUrl, permanentNutritionUrl] = await Promise.all([
          uploadHistoryImage(frontImageData, "history-front"),
          uploadHistoryImage(nutritionImageData, "history-label"),
        ]);

        if (cancelled) return;

        const res = await fetch("/api/previousSearches/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productName:
              productName || aiData.product_name || "Unknown product",
            imageFrontUrl: permanentFrontUrl,
            imageNutritionImage: permanentNutritionUrl,
            aiData,
          }),
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

        if (!cancelled) setError(null);
      } catch (err) {
        console.error("Could not save analysis history:", err);
        if (!cancelled) {
          setError(err?.message || "Failed to save search");
        }
      }
    }

    saveSearch();

    return () => {
      cancelled = true;
    };
  }, [aiData, imageFrontUrl, imageNutritionImage, productName, user]);

  const nutrition = aiData?.nutrition || {};
  const nutritionValidation = aiData?.nutrition_validation || {};

  const visibleIngredients = useMemo(
    () =>
      Array.isArray(aiData?.ingredients)
        ? aiData.ingredients.filter(Boolean)
        : [],
    [aiData]
  );

  const majorIngredients = useMemo(
    () =>
      Array.isArray(aiData?.major_ingredients)
        ? aiData.major_ingredients.filter((item) => item?.name)
        : [],
    [aiData]
  );

  const ingredientExplanations = useMemo(
    () =>
      Array.isArray(aiData?.ingredient_explanations)
        ? aiData.ingredient_explanations.filter((item) => item?.name)
        : [],
    [aiData]
  );

  const scoreReasons = useMemo(() => buildScoreReasons(aiData), [aiData]);

  if (!aiData) return null;

  const rating = Number(aiData.rating) || 0;
  const healthRating = Math.round(Math.min(10, Math.max(0, rating)) * 10) / 10;
  const scoreLabel =
    healthRating >= 8
      ? "Strong profile"
      : healthRating >= 6.5
      ? "Generally good"
      : healthRating >= 5
      ? "Mixed profile"
      : healthRating >= 3.5
      ? "Needs attention"
      : "Occasional choice";

  const nutriScoreGrade = String(aiData.nutriscore_grade || "").toUpperCase();

  const allergies = String(profile?.allergies || "")
    .split(/[,;]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  const ingredientText = [
    ...visibleIngredients,
    ...majorIngredients.map((item) => item.name),
  ]
    .join(" ")
    .toLowerCase();

  const allergyWarnings = allergies.filter(
    (allergen) => allergen && ingredientText.includes(allergen)
  );

  const dietaryPreferences = String(
    profile?.dietaryPreferences || ""
  ).toLowerCase();

  const dietaryWarnings = [];

  if (
    dietaryPreferences.includes("vegan") &&
    /(milk|whey|casein|gelatin|egg|honey|meat|chicken|fish)/i.test(
      ingredientText
    )
  ) {
    dietaryWarnings.push("Possible non-vegan ingredient detected");
  }

  if (
    dietaryPreferences.includes("vegetarian") &&
    /(gelatin|meat|chicken|beef|pork|fish|anchovy)/i.test(ingredientText)
  ) {
    dietaryWarnings.push("Possible non-vegetarian ingredient detected");
  }

  if (
    dietaryPreferences.includes("gluten") &&
    /(wheat|barley|rye|malt)/i.test(ingredientText)
  ) {
    dietaryWarnings.push("Possible gluten-containing ingredient detected");
  }

  const confidence = confidenceFromValidation(
    nutritionValidation,
    visibleIngredients.length
  );
  const confidenceTone = toneClasses[confidence.tone] || toneClasses.slate;

  const nutritionItems = [
    ["Calories", "calories", nutrition.calories, "kcal"],
    ["Added sugar", "added_sugar_g", nutrition.added_sugar_g, "g"],
    ["Total sugar", "total_sugar_g", nutrition.total_sugar_g, "g"],
    ["Saturated fat", "saturated_fat_g", nutrition.saturated_fat_g, "g"],
    ["Total fat", "total_fat_g", nutrition.total_fat_g, "g"],
    ["Carbohydrates", "carbohydrates_g", nutrition.carbohydrates_g, "g"],
    ["Fiber", "fiber_g", nutrition.fiber_g, "g"],
    ["Protein", "protein_g", nutrition.protein_g, "g"],
    ["Sodium", "sodium_mg", nutrition.sodium_mg, "mg"],
    ["Trans fat", "trans_fat_g", nutrition.trans_fat_g, "g"],
  ];

  return (
    <section className="app-canvas pt-6 pb-14">
      <div className="mx-auto max-w-5xl">
        <div className="glass-panel overflow-hidden p-4 sm:p-7 lg:p-8">
          <div className="grid gap-5 lg:grid-cols-[1fr_280px] lg:items-stretch">
            <div className="rounded-[1.75rem] border border-white/80 bg-white/65 p-5 sm:p-6">
              <div className="flex items-center gap-4">
                {(imageFrontUrl || imageNutritionImage) && (
                  <img
                    src={imageFrontUrl || imageNutritionImage}
                    alt="Product"
                    className="h-20 w-20 shrink-0 rounded-2xl border border-white bg-white object-contain p-2 shadow-sm"
                  />
                )}

                <div className="min-w-0">
                  <p className="eyebrow">Analysis complete</p>
                  <h1 className="mt-2 text-2xl font-semibold tracking-[-.04em] text-slate-950 sm:text-3xl">
                    {productName || aiData.product_name || "Unknown product"}
                  </h1>
                  {aiData.product_category &&
                    aiData.product_category !== "Unknown" && (
                      <p className="mt-1 text-sm text-slate-500">
                        {aiData.product_category}
                      </p>
                    )}
                </div>
              </div>

              <div className="mt-6 rounded-2xl bg-slate-950 p-5 text-white">
                <p className="text-[10px] font-bold uppercase tracking-[.16em] text-emerald-300">
                  Veronica&apos;s take
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-100 sm:text-base sm:leading-7">
                  {aiData.summary || "No summary was returned."}
                </p>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[1.75rem] bg-[#0B5F4A] p-6 text-white shadow-[0_20px_50px_rgba(11,95,74,.22)]">
              <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
              <p className="relative text-[10px] font-bold uppercase tracking-[.18em] text-emerald-100">
                Veronica score
              </p>

              <div className="relative mt-6 flex items-end gap-2">
                <span className="text-6xl font-semibold leading-none tracking-[-.06em]">
                  {healthRating}
                </span>
                <span className="mb-1 text-lg font-semibold text-emerald-100">
                  / 10
                </span>
              </div>

              <p className="relative mt-4 text-lg font-semibold">
                {scoreLabel}
              </p>

              {nutriScoreGrade && nutriScoreGrade !== "UNKNOWN" && (
                <div className="relative mt-5 border-t border-white/15 pt-4">
                  <p className="text-[10px] font-bold uppercase tracking-[.14em] text-emerald-100">
                    External reference
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    Nutri-Score {nutriScoreGrade}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
            <div className="rounded-[1.75rem] bg-white/55 p-5 sm:p-6">
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-emerald-700">
                Why this score
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-[-.03em] text-slate-950">
                What moved the rating
              </h2>

              <div className="mt-4 space-y-2.5">
                {scoreReasons.length > 0 ? (
                  scoreReasons.map((reason, index) => {
                    const styles =
                      reason.type === "positive"
                        ? "bg-emerald-50 text-emerald-900"
                        : reason.type === "negative"
                        ? "bg-rose-50 text-rose-900"
                        : "bg-amber-50 text-amber-900";

                    const icon =
                      reason.type === "positive"
                        ? "✓"
                        : reason.type === "negative"
                        ? "!"
                        : "•";

                    return (
                      <div
                        key={`${reason.title}-${index}`}
                        className={`flex items-center justify-between gap-4 rounded-xl px-4 py-3 ${styles}`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/70 text-xs font-black">
                            {icon}
                          </span>
                          <p className="text-sm font-bold">{reason.title}</p>
                        </div>
                        <p className="text-right text-[11px] font-semibold opacity-75">
                          {reason.detail}
                        </p>
                      </div>
                    );
                  })
                ) : (
                  <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    Not enough nutrition data was available to explain the score in detail.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-white/80 bg-white/70 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">
                    Data confidence
                  </p>
                  <h2 className="mt-1 text-xl font-semibold tracking-[-.03em] text-slate-950">
                    Can I trust this scan?
                  </h2>
                </div>
                <span className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide ${confidenceTone.badge}`}>
                  {confidence.label}
                </span>
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-600">
                {confidence.description}
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="font-bold text-slate-800">Nutrition</p>
                  <p className="mt-1 text-slate-500">
                    {nutritionValidation.status === "verified"
                      ? "Basic checks passed"
                      : "Verify against label"}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="font-bold text-slate-800">Ingredients</p>
                  <p className="mt-1 text-slate-500">
                    {visibleIngredients.length
                      ? `${visibleIngredients.length} detected`
                      : "Not clearly detected"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {(allergyWarnings.length > 0 ||
            dietaryWarnings.length > 0 ||
            aiData.user_specific_summary?.trim()) && (
            <div className="mt-5 rounded-[1.75rem] border border-amber-200/80 bg-amber-50/70 p-5 sm:p-6">
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-amber-700">
                For your profile
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-[-.03em] text-slate-950">
                Personal checks
              </h2>

              <div className="mt-4 flex flex-wrap gap-2">
                {allergyWarnings.map((item) => (
                  <span
                    key={item}
                    className="rounded-full bg-rose-100 px-3 py-2 text-xs font-bold text-rose-800"
                  >
                    Possible {item} match
                  </span>
                ))}
                {dietaryWarnings.map((item) => (
                  <span
                    key={item}
                    className="rounded-full bg-amber-100 px-3 py-2 text-xs font-bold text-amber-800"
                  >
                    {item}
                  </span>
                ))}
              </div>

              {aiData.user_specific_summary?.trim() && (
                <p className="mt-4 rounded-xl bg-white/70 p-4 text-sm leading-6 text-slate-700">
                  {aiData.user_specific_summary}
                </p>
              )}
            </div>
          )}

          <div className="mt-5 rounded-[1.75rem] bg-white/55 p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.16em] text-emerald-700">
                  Nutrition
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-.03em] text-slate-950">
                  What matters most
                </h2>
              </div>
              {nutrition.serving_size && (
                <span className="w-fit rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-slate-500">
                  Serving: {nutrition.serving_size}
                </span>
              )}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <NutrientCard
                label="Added sugar"
                nutrientKey="added_sugar_g"
                value={nutrition.added_sugar_g}
                unit="g"
              />
              <NutrientCard
                label="Saturated fat"
                nutrientKey="saturated_fat_g"
                value={nutrition.saturated_fat_g}
                unit="g"
              />
              <NutrientCard
                label="Sodium"
                nutrientKey="sodium_mg"
                value={nutrition.sodium_mg}
                unit="mg"
              />
              <NutrientCard
                label="Protein"
                nutrientKey="protein_g"
                value={nutrition.protein_g}
                unit="g"
              />
            </div>

            <details className="mt-4 rounded-2xl border border-white/80 bg-white/50 p-4">
              <summary className="cursor-pointer text-xs font-bold text-emerald-700">
                View full nutrition details
              </summary>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {nutritionItems.map(([label, key, value, unit]) => (
                  <div key={label} className="rounded-xl bg-white/80 p-3">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">
                      {label}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-950">
                      {value != null ? value : "—"}
                      {value != null && (
                        <span className="ml-1 text-[10px] font-medium text-slate-400">
                          {unit}
                        </span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </details>
          </div>

          {aiData.harmful_ingredients?.length > 0 && (
            <div className="mt-5 rounded-[1.75rem] bg-rose-50/65 p-5 sm:p-6">
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-rose-700">
                Ingredients to note
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-[-.03em] text-slate-950">
                Worth a closer look
              </h2>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {aiData.harmful_ingredients.slice(0, 4).map((item, index) => (
                  <div
                    key={`${item.name}-${index}`}
                    className="rounded-2xl border border-white/80 bg-white/75 p-4"
                  >
                    <p className="text-sm font-bold text-slate-950">
                      {item.name}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-slate-600">
                      {item.impact}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 rounded-[1.75rem] bg-white/55 p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.16em] text-emerald-700">
                  Better matches
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-.03em] text-slate-950">
                  Compare alternatives
                </h2>
              </div>

              {alternativesLoading && (
                <span className="w-fit rounded-full bg-emerald-100 px-3 py-1.5 text-[11px] font-semibold text-emerald-700">
                  Finding matches…
                </span>
              )}
            </div>

            <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">
              Same-category products with measurable nutrition differences and no detected profile conflicts.
            </p>

            {!alternativesLoading && alternatives.length > 0 && (
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {alternatives.map((item) => (
                  <article
                    key={item.barcode}
                    className="overflow-hidden rounded-2xl border border-white/90 bg-white/80 shadow-sm"
                  >
                    <div className="flex h-32 items-center justify-center bg-white p-4">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="h-full w-full object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-xs text-slate-400">No image</span>
                      )}
                    </div>

                    <div className="p-4">
                      <p className="text-sm font-bold leading-5 text-slate-950">
                        {item.name}
                      </p>
                      {item.brand && (
                        <p className="mt-1 text-xs text-slate-500">
                          {item.brand}
                        </p>
                      )}

                      <div className="mt-3 flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                          Match quality
                        </span>
                        <span className="text-sm font-black text-emerald-800">
                          {item.score}/100
                        </span>
                      </div>

                      {item.reasons?.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {item.reasons.slice(0, 3).map((reason) => (
                            <div
                              key={reason.key}
                              className="flex items-center gap-2 text-[11px] font-semibold leading-4 text-slate-700"
                            >
                              <span className="text-emerald-600">↓</span>
                              <span>{reason.text}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}

            {!alternativesLoading &&
              alternatives.length === 0 &&
              alternativesMessage && (
                <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
                  {alternativesMessage}
                </p>
              )}
          </div>

          <details className="mt-5 rounded-[1.75rem] bg-white/45 p-5 sm:p-6">
            <summary className="cursor-pointer text-sm font-bold uppercase tracking-[.13em] text-slate-600">
              Ingredients & detailed analysis
            </summary>

            <div className="mt-5 space-y-5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Full ingredient list
                </h3>
                {visibleIngredients.length ? (
                  <ol className="mt-3 grid gap-2 sm:grid-cols-2">
                    {visibleIngredients.map((ingredient, index) => (
                      <li
                        key={`${ingredient}-${index}`}
                        className="rounded-xl bg-white/70 px-3 py-2 text-xs leading-5 text-slate-700"
                      >
                        <span className="mr-2 font-semibold text-emerald-700">
                          {index + 1}.
                        </span>
                        {ingredient}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">
                    No readable ingredient list was detected.
                  </p>
                )}
              </div>

              {majorIngredients.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Major ingredients
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {majorIngredients.map((item, index) => (
                      <span
                        key={`${item.name}-major-${index}`}
                        className="rounded-full bg-white/80 px-3 py-2 text-xs text-slate-700"
                      >
                        {item.name}
                        {item.percentage != null
                          ? ` · ${item.percentage}%`
                          : ""}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {ingredientExplanations.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Ingredient explanations
                  </h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {ingredientExplanations.map((item, index) => (
                      <div
                        key={item.name + index}
                        className="rounded-xl bg-white/75 p-4"
                      >
                        <p className="text-sm font-bold text-slate-950">
                          {item.name}
                        </p>
                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                          {item.purpose}
                        </p>
                        <p className="mt-2 text-xs leading-5 text-slate-700">
                          {item.explanation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </details>

          <p className="mt-5 px-1 text-[10px] leading-4 text-slate-400">
            Veronica provides general food-label information, not medical advice. Nutrition values and ingredient detection may be incomplete or incorrectly read from packaging.
          </p>

          {error && (
            <p className="mt-4 text-sm text-rose-700">
              Could not save this result: {error}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
