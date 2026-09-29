"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useUserProfile } from "@/context/UserProfileContext";

async function makePermanentImageData(sourceUrl) {
  if (!sourceUrl) return null;

  if (sourceUrl.startsWith("data:")) {
    return sourceUrl;
  }

  if (!sourceUrl.startsWith("blob:")) {
    return null;
  }

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

  // Existing HTTPS images are already permanent.
  if (imageData.startsWith("https://")) {
    return imageData;
  }

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
              productName ||
              aiData.product_name ||
              "Unknown product",
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

  if (!aiData) return null;

  const rating = Number(aiData.rating) || 0;
  const nutrition = aiData.nutrition || {};
  const nutritionValidation = aiData.nutrition_validation || {};
  const nutritionItems = [
    ["Calories", nutrition.calories, "kcal"],
    ["Added sugar", nutrition.added_sugar_g, "g"],
    ["Total sugar", nutrition.total_sugar_g, "g"],
    ["Saturated fat", nutrition.saturated_fat_g, "g"],
    ["Total fat", nutrition.total_fat_g, "g"],
    ["Carbohydrates", nutrition.carbohydrates_g, "g"],
    ["Fiber", nutrition.fiber_g, "g"],
    ["Protein", nutrition.protein_g, "g"],
    ["Sodium", nutrition.sodium_mg, "mg"],
    ["Trans fat", nutrition.trans_fat_g, "g"],
  ];

  const visibleIngredients = Array.isArray(aiData.ingredients)
    ? aiData.ingredients.filter(Boolean)
    : [];

  const majorIngredients = Array.isArray(aiData.major_ingredients)
    ? aiData.major_ingredients.filter((item) => item?.name)
    : [];

  const healthRating = Math.round(Math.min(10, Math.max(0, rating)) * 10) / 10;
  const scoreGrade =
    healthRating >= 8 ? "A" :
    healthRating >= 6.5 ? "B" :
    healthRating >= 5 ? "C" :
    healthRating >= 3.5 ? "D" : "E";
  const scoreLabel =
    healthRating >= 8 ? "Strong profile" :
    healthRating >= 6.5 ? "Generally good" :
    healthRating >= 5 ? "Mixed profile" :
    healthRating >= 3.5 ? "Needs attention" : "Occasional choice";

  const nutriScoreGrade = String(aiData.nutriscore_grade || "").toUpperCase();
  const allergies = String(profile?.allergies || "")
    .split(/[,;]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const ingredientText = [
    ...(Array.isArray(visibleIngredients) ? visibleIngredients : []),
    ...(Array.isArray(majorIngredients) ? majorIngredients.map((item) => item.name) : []),
  ]
    .join(" ")
    .toLowerCase();
  const allergyWarnings = allergies.filter((allergen) =>
    allergen && ingredientText.includes(allergen)
  );
  const dietaryPreferences = String(profile?.dietaryPreferences || "").toLowerCase();
  const dietaryWarnings = [];
  if (dietaryPreferences.includes("vegan") && /(milk|whey|casein|gelatin|egg|honey|meat|chicken|fish)/i.test(ingredientText)) {
    dietaryWarnings.push("Possible non-vegan ingredient detected");
  }
  if (dietaryPreferences.includes("vegetarian") && /(gelatin|meat|chicken|beef|pork|fish|anchovy)/i.test(ingredientText)) {
    dietaryWarnings.push("Possible non-vegetarian ingredient detected");
  }
  if (dietaryPreferences.includes("gluten") && /(wheat|barley|rye|malt)/i.test(ingredientText)) {
    dietaryWarnings.push("Possible gluten-containing ingredient detected");
  }
  const ingredientExplanations = Array.isArray(aiData.ingredient_explanations)
    ? aiData.ingredient_explanations.filter((item) => item?.name)
    : [];

  return (
    <section className="app-canvas pt-6">
      <div className="mx-auto max-w-4xl">
        <div className="glass-panel p-5 sm:p-8">
          {/* Compact product header */}
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              {(imageFrontUrl || imageNutritionImage) && (
                <img
                  src={imageFrontUrl || imageNutritionImage}
                  alt="Product"
                  className="h-20 w-20 shrink-0 rounded-2xl border border-white/70 bg-white/70 object-contain p-2"
                />
              )}
              <div className="min-w-0">
                <p className="eyebrow">Analysis complete</p>
                <h1 className="mt-2 truncate text-2xl font-semibold tracking-[-.04em] text-slate-900 sm:text-3xl">
                  {productName || aiData.product_name || "Unknown product"}
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                  Quick, practical food-label analysis.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-3 self-start sm:self-auto">
              <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-emerald-700 px-2 text-center text-white shadow-lg shadow-emerald-900/20">
                <span className="text-3xl font-semibold leading-none">{healthRating}</span>
                <span className="mt-1 text-[8px] font-bold uppercase leading-3 tracking-[0.08em] text-emerald-100">
                  Health rating
                  <span className="block">/ 10</span>
                </span>
              </div>
              <div>
                <p className="text-3xl font-bold leading-none text-slate-900">{scoreGrade}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{scoreLabel}</p>
                {nutriScoreGrade && nutriScoreGrade !== "UNKNOWN" && (
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    Nutri-Score {nutriScoreGrade}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-7 grid gap-5">
            {/* What matters most */}
            <div className="rounded-2xl bg-white/55 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[.14em] text-emerald-700">
                    What matters most
                  </p>
                  <h2 className="mt-1 text-xl font-semibold tracking-[-.03em] text-slate-900">
                    Nutrition snapshot
                  </h2>
                </div>
                {nutrition.serving_size && (
                  <span className="rounded-full bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-slate-500">
                    {nutrition.serving_size}
                  </span>
                )}
              </div>

              {nutritionValidation.message && nutritionValidation.status !== "verified" && (
                <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
                  {nutritionValidation.message}
                </p>
              )}

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Calories", nutrition.calories, "kcal"],
                  ["Added sugar", nutrition.added_sugar_g, "g"],
                  ["Saturated fat", nutrition.saturated_fat_g, "g"],
                  ["Sodium", nutrition.sodium_mg, "mg"],
                ].map(([label, value, unit]) => (
                  <div key={label} className="rounded-xl border border-white/80 bg-white/70 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
                    <p className="mt-2 text-xl font-semibold text-slate-900">
                      {value != null ? value : "—"}
                      {value != null && <span className="ml-1 text-xs font-medium text-slate-500">{unit}</span>}
                    </p>
                  </div>
                ))}
              </div>

              <details className="mt-4">
                <summary className="cursor-pointer text-xs font-bold text-emerald-700">
                  View full nutrition details
                </summary>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {nutritionItems.map(([label, value, unit]) => (
                    <div key={label} className="rounded-xl bg-white/65 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {value != null ? value : "—"}
                        {value != null && <span className="ml-1 text-[10px] font-medium text-slate-500">{unit}</span>}
                      </p>
                    </div>
                  ))}
                </div>
                {nutritionValidation.status && (
                  <p className="mt-3 text-[11px] leading-5 text-slate-500">
                    {nutritionValidation.status === "verified" ? "Basic label consistency checks passed." : "Some values need verification against the package label."}
                  </p>
                )}
              </details>
            </div>

            {/* Simple verdict */}
            <div className="rounded-2xl bg-slate-900 p-5 text-white">
              <p className="text-[11px] font-bold uppercase tracking-[.14em] text-emerald-300">
                Veronica's take
              </p>
              <p className="mt-3 text-base leading-7 text-slate-100">
                {aiData.summary || "No summary was returned."}
              </p>
            </div>

            {/* Personal warnings only when relevant */}
            {(allergyWarnings.length > 0 || dietaryWarnings.length > 0) && (
              <div className="rounded-2xl border border-amber-200/80 bg-amber-50/75 p-5">
                <div className="flex items-center gap-2">
                  <span className="text-base">⚠</span>
                  <h2 className="text-sm font-bold text-amber-900">Personal warnings</h2>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {allergyWarnings.map((item) => (
                    <span key={item} className="rounded-full bg-rose-100 px-3 py-2 text-xs font-bold text-rose-800">
                      Possible {item} match
                    </span>
                  ))}
                  {dietaryWarnings.map((item) => (
                    <span key={item} className="rounded-full bg-amber-100 px-3 py-2 text-xs font-bold text-amber-800">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Alternatives */}
            <div className="rounded-2xl bg-white/55 p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[.14em] text-emerald-700">
                    Veronica suggestions
                  </p>
                  <h2 className="mt-1 text-xl font-semibold tracking-[-.03em] text-slate-900">
                    Better matches
                  </h2>
                </div>
                {alternativesLoading && (
                  <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-[11px] font-semibold text-emerald-700">
                    Finding matches…
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Comparable products with measurable nutrition differences.
              </p>

              {!alternativesLoading && alternatives.length > 0 && (
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {alternatives.map((item) => (
                    <article key={item.barcode} className="overflow-hidden rounded-2xl border border-white/80 bg-white/70">
                      <div className="flex h-28 items-center justify-center bg-white/60 p-3">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="h-full w-full object-contain" loading="lazy" />
                        ) : (
                          <span className="text-xs text-slate-400">No image</span>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-bold leading-5 text-slate-900">{item.name}</p>
                        {item.brand && <p className="mt-1 text-xs text-slate-500">{item.brand}</p>}
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Match</span>
                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">{item.score}/100</span>
                        </div>
                        {item.reasons?.length > 0 && (
                          <div className="mt-2 space-y-1.5">
                            {item.reasons.slice(0, 2).map((reason) => (
                              <div key={reason.key} className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold leading-4 text-emerald-800">
                                {reason.text}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {!alternativesLoading && alternatives.length === 0 && alternativesMessage && (
                <p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">{alternativesMessage}</p>
              )}
            </div>

            {/* Only show concerns when there are actual flags */}
            {aiData.harmful_ingredients?.length > 0 && (
              <div className="rounded-2xl bg-rose-50/70 p-5">
                <p className="text-[11px] font-bold uppercase tracking-[.14em] text-rose-700">
                  Things to note
                </p>
                <div className="mt-3 space-y-2">
                  {aiData.harmful_ingredients.slice(0, 3).map((item, index) => (
                    <div key={index} className="rounded-xl bg-white/65 p-3">
                      <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-600">{item.impact}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Everything else is available, but no longer dominates the page */}
            <details className="rounded-2xl bg-white/45 p-5">
              <summary className="cursor-pointer text-sm font-bold uppercase tracking-[.13em] text-slate-600">
                Ingredients & detailed analysis
              </summary>

              <div className="mt-5 space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Ingredients</h3>
                  {visibleIngredients.length ? (
                    <ol className="mt-3 grid gap-2 sm:grid-cols-2">
                      {visibleIngredients.map((ingredient, index) => (
                        <li key={`${ingredient}-${index}`} className="rounded-xl bg-white/60 px-3 py-2 text-xs leading-5 text-slate-700">
                          <span className="mr-2 font-semibold text-emerald-700">{index + 1}.</span>
                          {ingredient}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">No readable ingredient list was detected.</p>
                  )}
                </div>

                {majorIngredients.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Major ingredients</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {majorIngredients.map((item, index) => (
                        <span key={`${item.name}-major-${index}`} className="rounded-full bg-white/75 px-3 py-2 text-xs text-slate-700">
                          {item.name}{item.percentage != null ? ` · ${item.percentage}%` : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {ingredientExplanations.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Ingredient explanations</h3>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {ingredientExplanations.map((item, index) => (
                        <div key={item.name + index} className="rounded-xl bg-white/70 p-4">
                          <p className="text-sm font-bold text-slate-900">{item.name}</p>
                          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">{item.purpose}</p>
                          <p className="mt-2 text-xs leading-5 text-slate-700">{item.explanation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {aiData.user_specific_summary?.trim() && (
                  <div className="rounded-xl bg-violet-50/70 p-4">
                    <h3 className="text-sm font-bold text-violet-800">For your profile</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{aiData.user_specific_summary}</p>
                  </div>
                )}
              </div>
            </details>

            <p className="px-1 text-[10px] leading-4 text-slate-400">
              Veronica provides general food-label information, not medical advice. Nutrition data may be incomplete or incorrectly read from the package.
            </p>
          </div>

          {error && (
            <p className="mt-5 text-sm text-rose-700">
              Could not save this result: {error}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
