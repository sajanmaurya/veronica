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

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return null;
    }

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
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
    throw new Error(data?.error || "Failed to upload history image");
  }

  return data?.url || null;
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function statusFor(key, value) {
  const n = finite(value);
  if (n == null) return { label: "—", tone: "slate" };

  if (key === "protein_g") {
    if (n >= 10) return { label: "Good", tone: "emerald" };
    if (n >= 5) return { label: "Okay", tone: "amber" };
    return { label: "Low", tone: "slate" };
  }

  if (key === "fiber_g") {
    if (n >= 5) return { label: "Good", tone: "emerald" };
    if (n >= 2) return { label: "Okay", tone: "amber" };
    return { label: "Low", tone: "slate" };
  }

  if (key === "sodium_mg") {
    if (n <= 140) return { label: "Low", tone: "emerald" };
    if (n <= 400) return { label: "Moderate", tone: "amber" };
    return { label: "High", tone: "rose" };
  }

  if (key === "added_sugar_g" || key === "total_sugar_g") {
    if (n <= 5) return { label: "Low", tone: "emerald" };
    if (n <= 10) return { label: "Moderate", tone: "amber" };
    return { label: "High", tone: "rose" };
  }

  if (key === "saturated_fat_g") {
    if (n <= 1.5) return { label: "Low", tone: "emerald" };
    if (n <= 5) return { label: "Moderate", tone: "amber" };
    return { label: "High", tone: "rose" };
  }

  return { label: "Available", tone: "slate" };
}

const toneBadge = {
  emerald: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  rose: "bg-rose-50 text-rose-700",
  slate: "bg-slate-100 text-slate-600",
};

function cleanCategory(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim().replace(/^en:/i, "").replace(/-/g, " "))
    .filter((item) => item && item.toLowerCase() !== "unknown")
    .slice(0, 2)
    .join(" · ");
}

function sourceLabel(value) {
  if (value === "package_scan") return "Package scan";
  if (value === "open_food_facts") return "Open Food Facts";
  if (value === "web_verified") return "Verified web";
  return "Unverified";
}

function sourceTone(value) {
  if (value === "package_scan") return "bg-emerald-100 text-emerald-700";
  if (value === "open_food_facts") return "bg-sky-50 text-sky-700";
  if (value === "web_verified") return "bg-violet-50 text-violet-700";
  return "bg-amber-50 text-amber-700";
}

function normalizeIngredientName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function ingredientPresence(index, total) {
  if (total <= 3) return { label: "Higher presence", tone: "rose" };
  const position = (index + 1) / total;
  if (position <= 0.3) return { label: "Higher presence", tone: "rose" };
  if (position <= 0.65) return { label: "Medium presence", tone: "amber" };
  return { label: "Lower presence", tone: "slate" };
}

function buildHighlights(aiData) {
  const nutrition = aiData?.nutrition || {};
  const items = [];

  const protein = finite(nutrition.protein_g);
  const fiber = finite(nutrition.fiber_g);
  const sugar = finite(nutrition.added_sugar_g ?? nutrition.total_sugar_g);
  const sodium = finite(nutrition.sodium_mg);
  const satFat = finite(nutrition.saturated_fat_g);

  if (protein != null && protein >= 10) {
    items.push({ type: "good", text: "Good protein" });
  }
  if (fiber != null && fiber >= 5) {
    items.push({ type: "good", text: "Good fiber" });
  }
  if (sugar != null && sugar > 10) {
    items.push({ type: "warn", text: "High sugar" });
  }
  if (sodium != null && sodium > 400) {
    items.push({ type: "warn", text: "High sodium" });
  }
  if (satFat != null && satFat > 5) {
    items.push({ type: "warn", text: "High saturated fat" });
  }

  return items.slice(0, 4);
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

  useEffect(() => {
    let cancelled = false;

    async function loadAlternatives() {
      if (!aiData) return;
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

        if (!cancelled && response.ok && result.success) {
          setAlternatives(result.data?.alternatives || []);
        }
      } catch (err) {
        console.error("Could not load alternatives:", err);
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
        const nutritionImageData = await makePermanentImageData(imageNutritionImage);

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
            productName: productName || aiData.product_name || "Unknown product",
            imageFrontUrl: permanentFrontUrl,
            imageNutritionImage: permanentNutritionUrl,
            aiData,
          }),
        });

        if (!res.ok) throw new Error("Failed to save search");
        if (!cancelled) setError(null);
      } catch (err) {
        if (!cancelled) setError(err?.message || "Failed to save search");
      }
    }

    saveSearch();

    return () => {
      cancelled = true;
    };
  }, [aiData, imageFrontUrl, imageNutritionImage, productName, user]);

  const visibleIngredients = useMemo(
    () => (Array.isArray(aiData?.ingredients) ? aiData.ingredients.filter(Boolean) : []),
    [aiData]
  );

  const majorIngredients = useMemo(
    () =>
      Array.isArray(aiData?.major_ingredients)
        ? aiData.major_ingredients.filter((item) => item?.name)
        : [],
    [aiData]
  );

  const highlights = useMemo(() => buildHighlights(aiData), [aiData]);

  if (!aiData) return null;

  const nutrition = aiData.nutrition || {};
  const ratingVerified = aiData.rating_verified !== false && aiData.rating != null;
  const healthRating = ratingVerified
    ? Math.round(Math.min(10, Math.max(0, Number(aiData.rating) || 0)) * 10) / 10
    : null;
  const consumptionFrequency = !ratingVerified
    ? "Verify first"
    : healthRating >= 8
    ? "Regular"
    : healthRating >= 6
    ? "Moderate"
    : healthRating >= 4
    ? "Occasional"
    : "Rarely";

  const nutriScoreGrade = String(aiData.nutriscore_grade || "").toUpperCase();

  const allergies = String(profile?.allergies || "")
    .split(/[,;]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  const ingredientText = visibleIngredients.join(" ").toLowerCase();

  const allergyWarnings = allergies.filter(
    (item) => item && ingredientText.includes(item)
  );

  const dietaryPreferences = String(profile?.dietaryPreferences || "").toLowerCase();
  const dietaryWarnings = [];

  if (
    dietaryPreferences.includes("vegan") &&
    /(milk|whey|casein|gelatin|egg|honey|meat|chicken|fish)/i.test(ingredientText)
  ) {
    dietaryWarnings.push("Possible non-vegan ingredient");
  }

  if (
    dietaryPreferences.includes("vegetarian") &&
    /(gelatin|meat|chicken|beef|pork|fish|anchovy)/i.test(ingredientText)
  ) {
    dietaryWarnings.push("Possible non-vegetarian ingredient");
  }

  const topNutrition = [
    ["Sugar", "added_sugar_g", nutrition.added_sugar_g ?? nutrition.total_sugar_g, "g"],
    ["Protein", "protein_g", nutrition.protein_g, "g"],
    ["Sodium", "sodium_mg", nutrition.sodium_mg, "mg"],
    ["Calories", "calories", nutrition.calories, "kcal"],
  ];

  return (
    <section className="w-full py-2 sm:py-6">
      <div className="mx-auto w-full px-1.5 sm:max-w-3xl sm:px-5">
        <div className="overflow-hidden rounded-2xl border border-white/70 bg-white/60 shadow-[0_12px_34px_rgba(15,23,42,.07)] backdrop-blur-xl sm:rounded-[1.75rem]">
          <div className="p-3.5 sm:p-6">
            <div className="flex items-start gap-3">
              {(imageFrontUrl || imageNutritionImage) && (
                <img
                  src={imageFrontUrl || imageNutritionImage}
                  alt="Product"
                  className="h-16 w-16 shrink-0 rounded-2xl border border-white bg-white object-contain p-2"
                />
              )}

              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[.14em] text-emerald-700">
                  Analysis complete
                </p>
                <h1 className="mt-1 line-clamp-2 text-lg font-semibold leading-tight tracking-[-.03em] text-slate-950 sm:text-2xl">
                  {productName || aiData.product_name || "Unknown product"}
                </h1>
                {aiData.product_category && aiData.product_category !== "Unknown" && (
                  <p className="mt-1 truncate text-[11px] text-slate-500">
                    {cleanCategory(aiData.product_category)}
                  </p>
                )}
              </div>

              <div className="shrink-0 rounded-2xl bg-[#0B5F4A] px-3 py-2.5 text-right text-white">
                <p className="text-[8px] font-bold uppercase tracking-[.12em] text-emerald-100">
                  Score
                </p>
                <div className="mt-0.5 flex items-end justify-end gap-0.5">
                  <span className="text-2xl font-semibold leading-none tracking-[-.05em]">
                    {ratingVerified ? healthRating : "—"}
                  </span>
                  {ratingVerified && (
                    <span className="mb-0.5 text-[10px] text-emerald-100">/10</span>
                  )}
                </div>
                <p className="mt-1 text-[10px] font-semibold leading-none">
                  {consumptionFrequency}
                </p>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {aiData.product_quantity && (
                <span className="rounded-full bg-white/80 px-2 py-1 text-[9px] font-semibold text-slate-600">
                  Pack {aiData.product_quantity}
                </span>
              )}
              <span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${sourceTone(aiData.nutrition_source)}`}>
                Nutrition: {sourceLabel(aiData.nutrition_source)}
              </span>
              <span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${sourceTone(aiData.ingredients_source)}`}>
                Ingredients: {sourceLabel(aiData.ingredients_source)}
              </span>
              {nutriScoreGrade && nutriScoreGrade !== "UNKNOWN" && (
                <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-semibold text-emerald-700">
                  Nutri-Score {nutriScoreGrade}
                </span>
              )}
            </div>

            {aiData.nutrition_validation?.status === "needs_verification" && (
              <div className="mt-3 rounded-xl bg-amber-50 px-3 py-3">
                <p className="text-xs font-semibold text-amber-900">
                  Nutrition needs verification
                </p>
                <p className="mt-1 text-[10px] leading-4 text-amber-700">
                  {aiData.nutrition_validation?.message ||
                    "The barcode nutrition data failed consistency checks. Scan the package label to verify it."}
                </p>
              </div>
            )}

            <div className="mt-5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.14em] text-emerald-700">
                    Nutrition
                  </p>
                  <h2 className="mt-1 text-base font-semibold text-slate-950">
                    Quick view
                  </h2>
                </div>
                {nutrition.serving_size && (
                  <span className="text-[10px] font-semibold text-slate-400">
                    {nutrition.serving_size}
                  </span>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {topNutrition.map(([label, key, value, unit]) => {
                  const status = statusFor(key, value);

                  return (
                    <div
                      key={label}
                      className="rounded-2xl border border-white/80 bg-white/75 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            {label}
                          </p>
                          <p className="mt-1 text-lg font-semibold text-slate-950">
                            {value != null ? value : "—"}
                            {value != null && (
                              <span className="ml-1 text-[10px] text-slate-400">
                                {unit}
                              </span>
                            )}
                          </p>
                        </div>

                        {key !== "calories" && (
                          <span
                            className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase ${toneBadge[status.tone]}`}
                          >
                            {status.label}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>


            {highlights.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {highlights.map((item, index) => (
                  <span
                    key={index}
                    className={
                      item.type === "good"
                        ? "rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"
                        : item.type === "warn"
                        ? "rounded-full bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700"
                        : "rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600"
                    }
                  >
                    {item.text}
                  </span>
                ))}
              </div>
            )}

            <p className="mt-3 text-[13px] leading-5 text-slate-700 sm:text-sm sm:leading-6">
              {aiData.summary || "No summary was returned."}
            </p>

            {(allergyWarnings.length > 0 || dietaryWarnings.length > 0) && (
              <div className="mt-4 rounded-2xl bg-amber-50 p-4">
                <p className="text-xs font-bold text-amber-900">For your profile</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {allergyWarnings.map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-rose-100 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700"
                    >
                      Possible {item} match
                    </span>
                  ))}
                  {dietaryWarnings.map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-amber-100 px-2.5 py-1.5 text-[11px] font-semibold text-amber-700"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {visibleIngredients.length > 0 ? (
              <div className="mt-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-bold uppercase tracking-[.14em] text-emerald-700">
                    Ingredients
                  </p>
                  <span className="text-[10px] text-slate-400">
                    {visibleIngredients.length} found
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {visibleIngredients.slice(0, 6).map((ingredient, index) => (
                    <span
                      key={`${ingredient}-quick-${index}`}
                      className="max-w-full truncate rounded-full bg-white/80 px-2.5 py-1.5 text-[10px] font-medium text-slate-700"
                    >
                      {ingredient}
                    </span>
                  ))}
                </div>
                {visibleIngredients.length > 6 && (
                  <p className="mt-2 text-[10px] text-slate-400">
                    +{visibleIngredients.length - 6} more in full details
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-4 rounded-xl bg-amber-50 px-3 py-3">
                <p className="text-xs font-semibold text-amber-800">
                  Ingredient list not verified
                </p>
                <p className="mt-1 text-[10px] leading-4 text-amber-700">
                  Veronica could not find a reliable ingredient list for this exact product. Scan the package label to verify it.
                </p>
              </div>
            )}

            {aiData.harmful_ingredients?.length > 0 && (
              <div className="mt-5">
                <p className="text-[10px] font-bold uppercase tracking-[.14em] text-rose-700">
                  Ingredients to note
                </p>
                <div className="mt-2 space-y-2">
                  {aiData.harmful_ingredients.slice(0, 2).map((item, index) => (
                    <div key={index} className="rounded-xl bg-rose-50 px-3 py-3">
                      <p className="text-sm font-semibold text-slate-900">
                        {item.name}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        {item.impact}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <details className="mt-5 rounded-2xl border border-white/80 bg-white/55 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                View full details
              </summary>

              <div className="mt-4 space-y-5">
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    Full nutrition
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    {[
                      ["Total fat", nutrition.total_fat_g, "g"],
                      ["Saturated fat", nutrition.saturated_fat_g, "g"],
                      ["Carbohydrates", nutrition.carbohydrates_g, "g"],
                      ["Fiber", nutrition.fiber_g, "g"],
                      ["Total sugar", nutrition.total_sugar_g, "g"],
                      ["Added sugar", nutrition.added_sugar_g, "g"],
                      ["Protein", nutrition.protein_g, "g"],
                      ["Sodium", nutrition.sodium_mg, "mg"],
                    ].map(([label, value, unit]) => (
                      <div key={label} className="rounded-xl bg-slate-50 p-3">
                        <p className="text-[10px] text-slate-500">{label}</p>
                        <p className="mt-1 font-semibold text-slate-900">
                          {value != null ? `${value} ${unit}` : "—"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        Ingredients
                      </p>
                      <p className="mt-1 text-[10px] leading-4 text-slate-500">
                        Exact percentages are shown only when printed on the package. Otherwise presence is estimated from ingredient order.
                      </p>
                    </div>
                  </div>

                  {visibleIngredients.length ? (
                    <div className="mt-3 space-y-2">
                      {visibleIngredients.map((ingredient, index) => {
                        const normalized = normalizeIngredientName(ingredient);
                        const metadata = majorIngredients.find((item) => {
                          const itemName = normalizeIngredientName(item?.name);
                          return (
                            itemName &&
                            (normalized.includes(itemName) ||
                              itemName.includes(normalized))
                          );
                        });

                        const exactPercentage = finite(metadata?.percentage);
                        const exactAmount = finite(metadata?.amount_g_per_serving);
                        const presence = ingredientPresence(
                          index,
                          visibleIngredients.length
                        );

                        const badgeClass =
                          exactPercentage != null
                            ? "bg-emerald-50 text-emerald-700"
                            : presence.tone === "rose"
                            ? "bg-rose-50 text-rose-700"
                            : presence.tone === "amber"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-slate-100 text-slate-600";

                        const label =
                          exactPercentage != null
                            ? `${exactPercentage}%`
                            : exactAmount != null
                            ? `${exactAmount} g / serving`
                            : presence.label;

                        return (
                          <div
                            key={`${ingredient}-detail-${index}`}
                            className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5"
                          >
                            <div className="min-w-0 flex items-start gap-2">
                              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[9px] font-bold text-slate-500">
                                {index + 1}
                              </span>
                              <p className="text-[11px] leading-5 text-slate-700">
                                {ingredient}
                              </p>
                            </div>

                            <span
                              className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold ${badgeClass}`}
                            >
                              {label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-slate-400">
                      No readable ingredient list detected.
                    </p>
                  )}
                </div>

                {aiData.user_specific_summary?.trim() && (
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      Profile note
                    </p>
                    <p className="mt-2 text-xs leading-5 text-slate-600">
                      {aiData.user_specific_summary}
                    </p>
                  </div>
                )}
              </div>
            </details>

            {(alternativesLoading || alternatives.length > 0) && (
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.14em] text-emerald-700">
                    Alternatives
                  </p>
                  <h2 className="mt-1 text-base font-semibold text-slate-950">
                    Better options
                  </h2>
                </div>
                {alternativesLoading && (
                  <span className="text-[10px] text-slate-400">Loading…</span>
                )}
              </div>

              {!alternativesLoading && alternatives.length > 0 && (
                <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
                  {alternatives.slice(0, 3).map((item) => (
                    <article
                      key={item.barcode}
                      className="min-w-[180px] rounded-2xl border border-white/80 bg-white/75 p-3"
                    >
                      <div className="flex h-20 items-center justify-center rounded-xl bg-white">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="h-full w-full object-contain p-2"
                          />
                        ) : (
                          <span className="text-[10px] text-slate-400">No image</span>
                        )}
                      </div>

                      <p className="mt-2 line-clamp-2 text-xs font-semibold leading-4 text-slate-900">
                        {item.name}
                      </p>

                      {item.reasons?.[0]?.text && (
                        <p className="mt-2 text-[10px] font-semibold text-emerald-700">
                          {item.reasons[0].text}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>
            )}

            <p className="mt-4 text-[9px] leading-4 text-slate-400">
              General food-label information only. Packaging data can be incomplete or misread.
            </p>

            {error && (
              <p className="mt-3 text-xs text-rose-700">
                Could not save this result.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
