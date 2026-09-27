"use client";

import { useEffect, useMemo, useState } from "react";

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

function getRatingClass(rating) {
  if (rating >= 7) return "bg-emerald-100 text-emerald-700";
  if (rating >= 4) return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
}

export default function PreviousSearchesPage() {
  const [searches, setSearches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function fetchSearches() {
      try {
        const res = await fetch("/api/previousSearches/products");
        const data = await res.json();

        if (active) {
          setSearches(Array.isArray(data) ? data : []);
        }
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
    // Keep the newest record when the same analysis was accidentally saved twice.
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

  if (loading) {
    return (
      <main className="app-canvas min-h-[70vh] px-5 py-10">
        <div className="mx-auto max-w-6xl">
          <div className="glass-panel p-8 text-center text-slate-500">
            Loading your history...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-canvas min-h-[70vh] px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <p className="eyebrow">Your activity</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-[-.04em] text-slate-900 sm:text-4xl">
                Analysis history
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Products you have analyzed with Veronica.
              </p>
            </div>

            {searches.length > 0 && (
              <span className="w-fit rounded-full bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-500 shadow-sm ring-1 ring-black/5">
                {visibleSearches.length}{" "}
                {visibleSearches.length === 1 ? "analysis" : "analyses"}
              </span>
            )}
          </div>
        </header>

        {visibleSearches.length === 0 ? (
          <div className="glass-panel flex min-h-72 flex-col items-center justify-center p-8 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/70 text-2xl shadow-sm">
              🔎
            </div>
            <h2 className="text-xl font-semibold text-slate-800">
              No analyses yet
            </h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
              Upload a food label from the Analyze page and your results will
              appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleSearches.map((search) => {
              const rating = Number(search.aiData?.rating) || 0;
              const image =
                search.imageFrontUrl || search.imageNutritionImage || null;
              const name = search.productName || "Unknown product";

              return (
                <article
                  key={search.id}
                  className="group overflow-hidden rounded-3xl border border-white/70 bg-white/75 shadow-[0_12px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_50px_rgba(15,23,42,0.13)]"
                >
                  <div className="relative flex h-56 items-center justify-center overflow-hidden bg-white/60 p-5">
                    {image ? (
                      <img
                        src={image}
                        alt={name}
                        className="h-full w-full object-contain transition duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center rounded-2xl bg-slate-100 text-sm font-medium text-slate-400">
                        No image available
                      </div>
                    )}

                    <div
                      className={`absolute right-4 top-4 rounded-full px-3 py-1.5 text-xs font-bold shadow-sm ${getRatingClass(
                        rating
                      )}`}
                    >
                      {rating}/10
                    </div>
                  </div>

                  <div className="p-5">
                    <h2
                      className="min-h-[3.25rem] text-lg font-semibold leading-6 tracking-[-.02em] text-slate-900"
                      title={name}
                    >
                      {name}
                    </h2>

                    <div className="mt-4 flex items-center justify-between border-t border-slate-200/70 pt-4">
                      <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                        Analyzed
                      </span>
                      <time
                        dateTime={search.createdAt}
                        className="text-xs font-medium text-slate-500"
                      >
                        {formatDate(search.createdAt)}
                      </time>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
