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

  const rawScore = Math.round(Math.min(100, Math.max(0, rating * 10)));
  const scoreGrade =
    rawScore >= 80 ? "A" :
    rawScore >= 65 ? "B" :
    rawScore >= 50 ? "C" :
    rawScore >= 35 ? "D" : "E";
  const scoreLabel =
    rawScore >= 80 ? "Strong profile" :
    rawScore >= 65 ? "Generally good" :
    rawScore >= 50 ? "Mixed profile" :
    rawScore >= 35 ? "Needs attention" : "Occasional choice";

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
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="eyebrow">Analysis complete</p>
              <h1 className="mt-4 text-3xl font-semibold tracking-[-.04em] text-slate-900">
                {productName || aiData.product_name || "Unknown product"}
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                A practical look at what is inside.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-full bg-emerald-700 text-white shadow-lg shadow-emerald-900/20">
                <span className="text-3xl font-semibold">{rawScore}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">
                  Veronica / 100
                </span>
              </div>
              <div className="text-left">
                <p className="text-3xl font-bold text-slate-900">{scoreGrade}</p>
                <p className="text-xs font-semibold text-slate-500">{scoreLabel}</p>
                {nutriScoreGrade && nutriScoreGrade !== "UNKNOWN" && (
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    Nutri-Score {nutriScoreGrade}
                  </p>
                )}
              </div>
            </div>
          </div>

          {(imageFrontUrl || imageNutritionImage) && (
            <div className="mt-7 flex flex-wrap gap-3">
              {[imageFrontUrl, imageNutritionImage]
                .filter(Boolean)
                .map((src, index) => (
                  <img
                    key={src}
                    src={src}
                    alt={index ? "Nutrition label" : "Product"}
                    className="h-32 w-32 rounded-2xl border border-white/70 bg-white/50 object-contain p-2"
                  />
                ))}
            </div>
          )}

          <div className="mt-8 grid gap-5">
            <div className="rounded-2xl bg-white/45 p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-[.13em] text-slate-500">
                    Nutrition per serving
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {nutrition.serving_size
                      ? `Serving size: ${nutrition.serving_size}`
                      : "Values shown only when readable from the label."}
                  </p>
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  {nutrition.servings_per_container != null && (
                    <p className="text-xs font-medium text-slate-500">
                      {nutrition.servings_per_container} servings/package
                    </p>
                  )}
                  {nutritionValidation.status && (
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold ${nutritionValidation.status === "verified" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}
                    >
                      {nutritionValidation.status === "verified"
                        ? "Label data checked"
                        : "Needs label verification"}
                    </span>
                  )}
                </div>
              </div>

              {nutritionValidation.message && (
                <p
                  className={`mt-3 rounded-xl px-4 py-3 text-xs leading-5 ${nutritionValidation.status === "verified" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}
                >
                  {nutritionValidation.message}
                </p>
              )}

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {nutritionItems.map(([label, value, unit]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-white/70 bg-white/55 p-3"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {label}
                    </p>
                    <p className="mt-2 text-xl font-semibold text-slate-900">
                      {value != null ? value : "—"}
                      {value != null && (
                        <span className="ml-1 text-xs font-medium text-slate-500">
                          {unit}
                        </span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-white/55 p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[.14em] text-emerald-700">
                    Veronica suggestions
                  </p>
                  <h2 className="mt-1 text-xl font-semibold tracking-[-.03em] text-slate-900">
                    Better matches
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Comparable products with measurable nutrition differences. This is a comparison aid, not a medical recommendation.
                  </p>
                </div>
                {alternativesLoading && (
                  <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-[11px] font-semibold text-emerald-700">
                    Finding matches…
                  </span>
                )}
              </div>

              {!alternativesLoading && alternatives.length > 0 && (
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  {alternatives.map((item) => (
                    <article
                      key={item.barcode}
                      className="overflow-hidden rounded-2xl border border-white/80 bg-white/70 shadow-sm"
                    >
                      <div className="flex h-36 items-center justify-center bg-white/60 p-3">
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
                        <p className="text-sm font-bold leading-5 text-slate-900">
                          {item.name}
                        </p>
                        {item.brand && (
                          <p className="mt-1 text-xs text-slate-500">{item.brand}</p>
                        )}

                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Comparison score
                          </span>
                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
                            {item.score}/100
                          </span>
                        </div>

                        {item.nutriscore && (
                          <p className="mt-2 text-xs font-semibold text-slate-600">
                            Nutri-Score: {String(item.nutriscore).toUpperCase()}
                          </p>
                        )}

                        {item.reasons?.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {item.reasons.map((reason) => (
                              <div
                                key={reason.key}
                                className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold leading-4 text-emerald-800"
                              >
                                {reason.text}
                              </div>
                            ))}
                          </div>
                        )}

                        <p className="mt-3 text-[10px] leading-4 text-slate-400">
                          Nutrition values are from Open Food Facts and may be incomplete or user-contributed.
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {!alternativesLoading && alternatives.length === 0 && alternativesMessage && (
                <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
                  {alternativesMessage}
                </p>
              )}
            </div>


            {(allergyWarnings.length > 0 || dietaryWarnings.length > 0) && (
              <div className="rounded-2xl border border-amber-200/80 bg-amber-50/70 p-5">
                <h2 className="text-sm font-bold uppercase tracking-[.13em] text-amber-800">
                  Personal warnings
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {allergyWarnings.map((item) => (
                    <span key={item} className="rounded-full bg-rose-100 px-3 py-2 text-xs font-bold text-rose-800">
                      ⚠ Possible {item} match
                    </span>
                  ))}
                  {dietaryWarnings.map((item) => (
                    <span key={item} className="rounded-full bg-amber-100 px-3 py-2 text-xs font-bold text-amber-800">
                      ⚠ {item}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-5 text-amber-900/80">
                  These are ingredient-text matches, not medical clearance or a guarantee that a product is safe for you.
                </p>
              </div>
            )}

            <div className="rounded-2xl bg-white/45 p-5">
              <h2 className="text-sm font-bold uppercase tracking-[.13em] text-slate-500">
                Ingredients
              </h2>
              {visibleIngredients.length ? (
                <ol className="mt-4 grid gap-2 sm:grid-cols-2">
                  {visibleIngredients.map((ingredient, index) => (
                    <li
                      key={`${ingredient}-${index}`}
                      className="rounded-xl bg-white/60 px-4 py-3 text-sm leading-5 text-slate-700"
                    >
                      <span className="mr-2 font-semibold text-emerald-700">
                        {index + 1}.
                      </span>
                      {ingredient}
                    </li>
                  ))}
                </ol>
              ) : majorIngredients.length ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {majorIngredients.map((item, index) => (
                    <div
                      key={`${item.name}-${index}`}
                      className="rounded-xl bg-white/60 px-4 py-3 text-sm text-slate-700"
                    >
                      <strong className="text-slate-900">{item.name}</strong>
                      {item.percentage != null && (
                        <span className="ml-2 text-slate-500">
                          {item.percentage}%
                        </span>
                      )}
                      {item.amount_g_per_serving != null && (
                        <span className="ml-2 text-slate-500">
                          {item.amount_g_per_serving} g/serving
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">
                  No readable ingredient list was detected in this image. Try a clearer close-up of the ingredients panel.
                </p>
              )}
            </div>

            {majorIngredients.length > 0 && (
              <div className="rounded-2xl bg-emerald-50/55 p-5">
                <h2 className="text-sm font-bold uppercase tracking-[.13em] text-emerald-700">
                  Major ingredients
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {majorIngredients.map((item, index) => (
                    <span
                      key={`${item.name}-major-${index}`}
                      className="rounded-full bg-white/75 px-3 py-2 text-sm text-slate-700"
                    >
                      {item.name}
                      {item.percentage != null ? ` · ${item.percentage}%` : ""}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {ingredientExplanations.length > 0 && (
              <div className="rounded-2xl bg-amber-50/55 p-5">
                <h2 className="text-sm font-bold uppercase tracking-[.13em] text-amber-800">
                  Ingredient deep dive
                </h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {ingredientExplanations.map((item, index) => (
                    <div key={item.name + index} className="rounded-xl bg-white/70 p-4">
                      <p className="font-bold text-slate-900">{item.name}</p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-amber-700">{item.purpose}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{item.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-2xl bg-rose-50/55 p-5">
              <h2 className="text-sm font-bold uppercase tracking-[.13em] text-rose-700">
                Ingredients to note
              </h2>

              {aiData.harmful_ingredients?.length ? (
                <ul className="mt-3 space-y-3">
                  {aiData.harmful_ingredients.map((item, index) => (
                    <li
                      key={index}
                      className="border-l-2 border-rose-400 pl-4 text-sm leading-6 text-slate-700"
                    >
                      <strong className="font-semibold text-slate-900">
                        {item.name}
                      </strong>
                      <br />
                      {item.impact}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-500">
                  No specific ingredient concern was flagged from the visible label.
                </p>
              )}
            </div>

            <div className="rounded-2xl bg-white/45 p-5">
              <h2 className="text-sm font-bold uppercase tracking-[.13em] text-slate-500">
                Summary
              </h2>
              <p className="mt-3 leading-7 text-slate-700">
                {aiData.summary || "No summary was returned."}
              </p>
            </div>

            {aiData.user_specific_summary?.trim() && (
              <div className="rounded-2xl bg-violet-50/55 p-5">
                <h2 className="text-sm font-bold uppercase tracking-[.13em] text-violet-700">
                  For your profile
                </h2>
                <p className="mt-3 leading-7 text-slate-700">
                  {aiData.user_specific_summary}
                </p>
              </div>
            )}
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
