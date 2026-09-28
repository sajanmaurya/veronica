"use client";

import { useEffect, useMemo, useState } from "react";

const REFERENCE = {
  calories: { label: "Calories", value: 2000, unit: "kcal", direction: "limit", note: "general guide" },
  added_sugar_g: { label: "Added sugar", value: 50, unit: "g", direction: "limit" },
  saturated_fat_g: { label: "Saturated fat", value: 20, unit: "g", direction: "limit" },
  sodium_mg: { label: "Sodium", value: 2300, unit: "mg", direction: "limit" },
  fiber_g: { label: "Fiber", value: 28, unit: "g", direction: "goal" },
  protein_g: { label: "Protein", value: 50, unit: "g", direction: "goal" },
};

const TRACKED_KEYS = [
  "calories",
  "added_sugar_g",
  "saturated_fat_g",
  "sodium_mg",
  "fiber_g",
  "protein_g",
];

function formatDate(value) {
  if (!value) return "Unknown date";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatNumber(value, decimals = 1) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const n = Number(value);
  return Number.isInteger(n)
    ? n.toLocaleString("en-IN")
    : n.toLocaleString("en-IN", { maximumFractionDigits: decimals });
}

function getRatingClass(rating) {
  if (rating >= 7) return "bg-emerald-50/75 text-emerald-700 ring-emerald-200/60";
  if (rating >= 4) return "bg-amber-50/75 text-amber-700 ring-amber-200/60";
  return "bg-rose-50/75 text-rose-700 ring-rose-200/60";
}

function HistoryImage({ src, name }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center rounded-2xl bg-white/45 text-center ring-1 ring-inset ring-white/65">
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-white/45 text-lg shadow-sm">
          🍽️
        </div>
        <span className="text-[11px] font-medium text-slate-700">No image</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      onError={() => setFailed(true)}
      className="h-full w-full object-contain drop-shadow-[0_10px_15px_rgba(15,23,42,.10)] transition duration-300 group-hover:scale-[1.035]"
    />
  );
}

function getNutrition(search) {
  const n = search?.aiData?.nutrition;
  return n && typeof n === "object" ? n : {};
}

function sumNutrition(searches) {
  return searches.reduce((totals, search) => {
    const n = getNutrition(search);

    TRACKED_KEYS.forEach((key) => {
      const value = Number(n[key]);
      if (Number.isFinite(value)) {
        totals[key] += value;
        totals.has[key] = true;
      }
    });

    return totals;
  }, {
    calories: 0,
    added_sugar_g: 0,
    saturated_fat_g: 0,
    sodium_mg: 0,
    fiber_g: 0,
    protein_g: 0,
    has: {
      calories: false,
      added_sugar_g: false,
      saturated_fat_g: false,
      sodium_mg: false,
      fiber_g: false,
      protein_g: false,
    },
  });
}

function nutrientStatus(key, value) {
  if (value == null || !REFERENCE[key]) return "Not tracked";

  const reference = REFERENCE[key];
  const percentage = (value / reference.value) * 100;

  if (reference.direction === "limit") {
    if (percentage > 100) return "Above reference";
    if (percentage >= 80) return "Near reference";
    return "Within reference";
  }

  if (percentage >= 100) return "Reference reached";
  return "Below reference";
}

function statusClass(status) {
  if (status === "Above reference") return "text-rose-700";
  if (status === "Near reference") return "text-amber-700";
  if (status === "Reference reached") return "text-emerald-700";
  if (status === "Within reference") return "text-emerald-700";
  return "text-slate-700";
}

function NutrientCard({ label, value, referenceKey, decimals = 0 }) {
  const ref = REFERENCE[referenceKey];
  const hasValue = value != null && Number.isFinite(Number(value));
  const percentage = hasValue ? Math.min((Number(value) / ref.value) * 100, 100) : 0;
  const status = hasValue ? nutrientStatus(referenceKey, Number(value)) : "Not tracked";

  return (
    <div className="rounded-[1.4rem] bg-white/58 p-4 ring-1 ring-inset ring-white/70">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-[.12em] text-slate-700">{label}</p>
        <span className={`text-[10px] font-semibold ${statusClass(status)}`}>{status}</span>
      </div>

      <div className="mt-3 flex items-end gap-1.5">
        <span className="text-2xl font-semibold tracking-[-.04em] text-slate-900">
          {hasValue ? formatNumber(value, decimals) : "—"}
        </span>
        <span className="pb-0.5 text-xs font-medium text-slate-700">{ref.unit}</span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-900/8">
        <div
          className="h-full rounded-full bg-emerald-600/70 transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <p className="mt-2 text-[11px] leading-4 text-slate-700">
        {ref.direction === "limit" ? "< " : "≥ "}
        {formatNumber(ref.value, 0)} {ref.unit}
        {referenceKey === "calories" ? " general guide" : " general daily reference"}
      </p>
    </div>
  );
}

function DayBar({ label, value, max, unit }) {
  const height = max > 0 ? Math.max(5, Math.min((value / max) * 100, 100)) : 5;

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
      <span className="text-[10px] font-medium text-slate-700">
        {value > 0 ? `${formatNumber(value, 0)}${unit}` : "—"}
      </span>
      <div className="flex h-28 w-full items-end justify-center rounded-2xl bg-white/45 px-1.5 ring-1 ring-inset ring-white/65">
        <div
          className="w-full max-w-9 rounded-t-xl bg-emerald-600/55"
          style={{ height: `${height}%` }}
        />
      </div>
      <span className="text-[10px] font-bold uppercase tracking-[.1em] text-slate-700">{label}</span>
    </div>
  );
}

export default function PreviousSearchesPage() {
  const [searches, setSearches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("7");

  useEffect(() => {
    let active = true;

    async function fetchSearches() {
      try {
        const res = await fetch("/api/previousSearches/products");
        const data = await res.json();
        if (active) setSearches(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Error fetching previous searches:", error);
        if (active) setSearches([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchSearches();
    return () => {
      active = false;
    };
  }, []);

  const visibleSearches = useMemo(() => {
    const seen = new Set();

    return searches.filter((search) => {
      const signature = [
        search.productName || "Unknown product",
        search.createdAt || "",
        search.aiData?.rating ?? "",
      ].join("|");

      if (seen.has(signature)) return false;
      seen.add(signature);
      return true;
    });
  }, [searches]);

  const periodSearches = useMemo(() => {
    const days = Number(period);
    const cutoff = Date.now() - (days - 1) * 24 * 60 * 60 * 1000;

    return visibleSearches.filter((search) => {
      const time = new Date(search.createdAt).getTime();
      return Number.isFinite(time) && time >= cutoff;
    });
  }, [visibleSearches, period]);

  const totals = useMemo(() => sumNutrition(periodSearches), [periodSearches]);

  const dailyData = useMemo(() => {
    const days = Number(period);
    const result = [];

    for (let i = days - 1; i >= 0; i -= 1) {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - i);

      const key = date.toISOString().slice(0, 10);
      const daySearches = periodSearches.filter((search) => {
        const d = new Date(search.createdAt);
        return d.toISOString().slice(0, 10) === key;
      });

      const dayTotals = sumNutrition(daySearches);

      result.push({
        key,
        label: date.toLocaleDateString("en-IN", { weekday: "short" }),
        calories: dayTotals.has.calories ? dayTotals.calories : 0,
        sugar: dayTotals.has.added_sugar_g ? dayTotals.added_sugar_g : 0,
      });
    }

    return result;
  }, [periodSearches, period]);

  const maxCalories = Math.max(...dailyData.map((day) => day.calories), 2000);
  const ingredientInsights = useMemo(() => {
    const map = new Map();

    periodSearches.forEach((search) => {
      const ingredients = search.aiData?.major_ingredients;
      if (!Array.isArray(ingredients)) return;

      ingredients.forEach((ingredient) => {
        const name = String(ingredient?.name || "").trim();
        if (!name) return;

        const key = name.toLowerCase();
        const current = map.get(key) || {
          name,
          amount: 0,
          hasAmount: false,
          percentage: 0,
          hasPercentage: false,
          appearances: 0,
        };

        current.appearances += 1;

        const amount = Number(ingredient.amount_g_per_serving);
        if (Number.isFinite(amount)) {
          current.amount += amount;
          current.hasAmount = true;
        }

        const percentage = Number(ingredient.percentage);
        if (Number.isFinite(percentage)) {
          current.percentage += percentage;
          current.hasPercentage = true;
        }

        map.set(key, current);
      });
    });

    return [...map.values()]
      .sort((a, b) => {
        if (b.hasAmount !== a.hasAmount) return Number(b.hasAmount) - Number(a.hasAmount);
        if (b.amount !== a.amount) return b.amount - a.amount;
        return b.appearances - a.appearances;
      })
      .slice(0, 6);
  }, [periodSearches]);

  if (loading) {
    return (
      <main className="app-canvas">
        <div className="mx-auto max-w-6xl">
          <div className="glass-panel p-10 text-center text-sm text-slate-700">
            Loading your food insights...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-canvas bg-white/50 px-4 pb-16 pt-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <section className="glass-panel relative mb-6 overflow-hidden px-5 py-6 sm:px-7">
          <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-white/45 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-40 w-40 rounded-full bg-emerald-200/15 blur-3xl" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="eyebrow">Your food insights</span>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-.045em] text-slate-900 sm:text-4xl">
                Track what you analyze
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">
                See calories, sugar, key nutrients, and major ingredients across
                the foods you've analyzed. This is tracked from analyzed servings,
                not a complete record of everything you ate.
              </p>
            </div>

            <div className="glass-surface flex w-fit rounded-full p-1">
              {["1", "7", "30"].map((value) => (
                <button
                  key={value}
                  onClick={() => setPeriod(value)}
                  className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                    period === value
                      ? "bg-emerald-700 text-white shadow-sm"
                      : "text-slate-700 hover:bg-white/50"
                  }`}
                >
                  {value === "1" ? "Today" : `${value} days`}
                </button>
              ))}
            </div>
          </div>
        </section>

        {visibleSearches.length === 0 ? (
          <div className="glass-panel flex min-h-80 flex-col items-center justify-center p-8 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[1.35rem] bg-white/40 text-2xl shadow-sm ring-1 ring-white/60">
              🔎
            </div>
            <h2 className="text-xl font-semibold text-slate-800">No analyses yet</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-700">
              Analyze a food label and Veronica will start building your nutrition
              insights here.
            </p>
          </div>
        ) : (
          <>
            <section className="mb-6">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <span className="eyebrow">Nutrition snapshot</span>
                  <h2 className="mt-1 text-xl font-semibold tracking-[-.025em] text-slate-900">
                    Tracked from analyzed foods
                  </h2>
                </div>
                <span className="text-xs font-medium text-slate-700">
                  {periodSearches.length} analyzed serving{periodSearches.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
                <NutrientCard
                  label="Calories"
                  value={totals.has.calories ? totals.calories : null}
                  referenceKey="calories"
                  decimals={0}
                />
                <NutrientCard
                  label="Added sugar"
                  value={totals.has.added_sugar_g ? totals.added_sugar_g : null}
                  referenceKey="added_sugar_g"
                />
                <NutrientCard
                  label="Sat. fat"
                  value={totals.has.saturated_fat_g ? totals.saturated_fat_g : null}
                  referenceKey="saturated_fat_g"
                />
                <NutrientCard
                  label="Sodium"
                  value={totals.has.sodium_mg ? totals.sodium_mg : null}
                  referenceKey="sodium_mg"
                />
                <NutrientCard
                  label="Fiber"
                  value={totals.has.fiber_g ? totals.fiber_g : null}
                  referenceKey="fiber_g"
                />
                <NutrientCard
                  label="Protein"
                  value={totals.has.protein_g ? totals.protein_g : null}
                  referenceKey="protein_g"
                />
              </div>
            </section>

            <section className="mb-6 grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
              <div className="glass-panel p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="eyebrow">7-day view</span>
                    <h2 className="mt-1 text-xl font-semibold text-slate-900">
                      Calories tracked
                    </h2>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-700">Reference</p>
                    <p className="text-sm font-semibold text-slate-700">2,000 kcal/day*</p>
                  </div>
                </div>

                <div className="mt-5 flex gap-2">
                  {dailyData.map((day) => (
                    <DayBar
                      key={day.key}
                      label={day.label}
                      value={day.calories}
                      max={maxCalories}
                      unit=" kcal"
                    />
                  ))}
                </div>
              </div>

              <div className="glass-panel p-5 sm:p-6">
                <span className="eyebrow">Sugar check</span>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">
                  Added sugar
                </h2>

                <div className="mt-5 flex items-end gap-2">
                  <span className="text-4xl font-semibold tracking-[-.05em] text-slate-900">
                    {totals.has.added_sugar_g ? formatNumber(totals.added_sugar_g, 1) : "—"}
                  </span>
                  <span className="pb-1 text-sm text-slate-700">g tracked</span>
                </div>

                <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-900/8">
                  <div
                    className="h-full rounded-full bg-amber-500/65"
                    style={{
                      width: `${Math.min(
                        ((totals.has.added_sugar_g ? totals.added_sugar_g : 0) / 50) * 100,
                        100
                      )}%`,
                    }}
                  />
                </div>

                <p className="mt-3 text-xs leading-5 text-slate-700">
                  General reference: less than 50 g/day on a 2,000-calorie diet.*
                </p>
              </div>
            </section>

            <section className="mb-8 glass-panel p-5 sm:p-6">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <span className="eyebrow">Ingredient exposure</span>
                  <h2 className="mt-1 text-xl font-semibold text-slate-900">
                    Major ingredients tracked
                  </h2>
                </div>
                <p className="max-w-xl text-xs leading-5 text-slate-700">
                  Amounts are shown only when the label provides enough information
                  to calculate them. Otherwise Veronica shows how often the ingredient appeared.
                </p>
              </div>

              {ingredientInsights.length ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {ingredientInsights.map((ingredient) => (
                    <div
                      key={ingredient.name.toLowerCase()}
                      className="rounded-2xl bg-white/55 p-4 ring-1 ring-inset ring-white/70"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-semibold text-slate-800">{ingredient.name}</p>
                        <span className="rounded-full bg-white/55 px-2 py-1 text-[10px] font-bold text-slate-700">
                          {ingredient.appearances}×
                        </span>
                      </div>

                      {ingredient.hasAmount ? (
                        <p className="mt-3 text-2xl font-semibold tracking-[-.04em] text-slate-900">
                          {formatNumber(ingredient.amount, 1)}
                          <span className="ml-1 text-xs font-medium text-slate-700">g tracked</span>
                        </p>
                      ) : (
                        <p className="mt-3 text-sm font-medium text-slate-700">
                          Quantity not available from label
                        </p>
                      )}

                      {ingredient.hasPercentage && (
                        <p className="mt-1 text-xs text-slate-700">
                          Explicit ingredient percentages totaled across analyzed servings:
                          {" "}
                          {formatNumber(ingredient.percentage, 1)}%
                        </p>
                      )}

                      <p className="mt-3 text-[11px] text-slate-700">
                        Based on analyzed serving data
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-2xl bg-white/50 p-5 text-sm text-slate-700">
                  Major ingredient quantities will appear as new labels are analyzed.
                  Veronica does not invent quantities that are not visible on the package.
                </div>
              )}
            </section>

            <section>
              <div className="mb-3 flex items-end justify-between">
                <div>
                  <span className="eyebrow">Scan archive</span>
                  <h2 className="mt-1 text-xl font-semibold text-slate-900">
                    Recent analyses
                  </h2>
                </div>
                <span className="text-xs text-slate-700">{visibleSearches.length} total</span>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {visibleSearches.map((search) => {
                  const rating = Number(search.aiData?.rating) || 0;
                  const image = search.imageFrontUrl || search.imageNutritionImage || null;
                  const name = search.productName || "Unknown product";
                  const nutrition = getNutrition(search);

                  return (
                    <article
                      key={search.id}
                      className="group glass-surface overflow-hidden rounded-[1.35rem] transition duration-300 hover:-translate-y-1 hover:bg-white/55 hover:shadow-[0_18px_40px_rgba(20,45,35,.14)]"
                    >
                      <div className="relative m-1.5 h-36 overflow-hidden rounded-[1.05rem] bg-white/18 p-3 ring-1 ring-inset ring-white/70">
                        <HistoryImage src={image} name={name} />
                        <div
                          className={`absolute right-2 top-2 rounded-full px-2.5 py-1 text-[10px] font-bold shadow-sm ring-1 backdrop-blur-xl ${getRatingClass(
                            rating
                          )}`}
                        >
                          {rating}/10
                        </div>
                      </div>

                      <div className="px-3 pb-3 pt-2">
                        <h2
                          className="min-h-[2.5rem] text-sm font-semibold leading-5 tracking-[-.015em] text-slate-900"
                          title={name}
                        >
                          {name}
                        </h2>

                        <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-700">
                          {nutrition.calories != null && <span>{formatNumber(nutrition.calories, 0)} kcal</span>}
                          {nutrition.added_sugar_g != null && (
                            <span>• {formatNumber(nutrition.added_sugar_g, 1)}g sugar</span>
                          )}
                        </div>

                        <div className="mt-2 border-t border-white/55 pt-2">
                          <time dateTime={search.createdAt} className="text-[10px] font-medium text-slate-700">
                            {formatDate(search.createdAt)}
                          </time>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <p className="mt-6 text-center text-[11px] leading-5 text-slate-700">
              * General FDA Daily Values/reference amounts. 2,000 calories/day is a
              general guide; individual calorie and nutrient needs vary. Tracked totals
              reflect analyzed serving data and may not represent everything consumed.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
