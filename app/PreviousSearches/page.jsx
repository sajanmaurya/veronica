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
  if (rating >= 7) return "bg-emerald-50/75 text-emerald-700 ring-emerald-200/60";
  if (rating >= 4) return "bg-amber-50/75 text-amber-700 ring-amber-200/60";
  return "bg-rose-50/75 text-rose-700 ring-rose-200/60";
}

function HistoryImage({ src, name }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center rounded-[1.5rem] bg-white/25 text-center ring-1 ring-inset ring-white/45">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/45 text-xl shadow-sm">
          🍽️
        </div>
        <span className="text-xs font-medium text-slate-400">
          Image unavailable
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      onError={() => setFailed(true)}
      className="h-full w-full object-contain drop-shadow-[0_12px_18px_rgba(15,23,42,.10)] transition duration-500 group-hover:scale-[1.035]"
    />
  );
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
    // Hide exact accidental duplicates while preserving separate analyses.
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
      <main className="app-canvas">
        <div className="mx-auto max-w-6xl">
          <div className="glass-panel p-10 text-center text-sm text-slate-500">
            Loading your history...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-canvas px-4 pb-16 pt-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Glass header */}
        <section className="glass-panel relative mb-7 overflow-hidden px-5 py-6 sm:px-7">
          <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-white/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-40 w-40 rounded-full bg-emerald-200/15 blur-3xl" />

          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="eyebrow">Your activity</span>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-.045em] text-slate-900 sm:text-4xl">
                Analysis history
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                A glass archive of the food products you have analyzed with
                Veronica.
              </p>
            </div>

            <div className="glass-surface flex w-fit items-center gap-3 rounded-full px-4 py-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600/10 text-sm">
                ✦
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.12em] text-slate-400">
                  Analyses
                </p>
                <p className="text-sm font-semibold text-slate-800">
                  {visibleSearches.length}
                </p>
              </div>
            </div>
          </div>
        </section>

        {visibleSearches.length === 0 ? (
          <div className="glass-panel flex min-h-80 flex-col items-center justify-center p-8 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[1.35rem] bg-white/40 text-2xl shadow-sm ring-1 ring-white/60">
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
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleSearches.map((search) => {
              const rating = Number(search.aiData?.rating) || 0;
              const image =
                search.imageFrontUrl || search.imageNutritionImage || null;
              const name = search.productName || "Unknown product";

              return (
                <article
                  key={search.id}
                  className="group glass-surface overflow-hidden rounded-[2rem] transition duration-300 hover:-translate-y-1 hover:bg-white/35 hover:shadow-[0_24px_60px_rgba(20,45,35,.16)]"
                >
                  {/* Image glass chamber */}
                  <div className="relative m-2 h-64 overflow-hidden rounded-[1.55rem] bg-white/18 p-5 ring-1 ring-inset ring-white/55">
                    <div className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-white/35 blur-2xl" />
                    <div className="pointer-events-none absolute -bottom-12 -right-8 h-36 w-36 rounded-full bg-emerald-100/15 blur-3xl" />

                    <div className="relative h-full w-full">
                      <HistoryImage src={image} name={name} />
                    </div>

                    <div
                      className={`absolute right-3 top-3 rounded-full px-3.5 py-1.5 text-xs font-bold shadow-sm ring-1 backdrop-blur-xl ${getRatingClass(
                        rating
                      )}`}
                    >
                      {rating}/10
                    </div>
                  </div>

                  {/* Product information */}
                  <div className="px-5 pb-5 pt-3">
                    <h2
                      className="min-h-[3.4rem] text-lg font-semibold leading-6 tracking-[-.025em] text-slate-900"
                      title={name}
                    >
                      {name}
                    </h2>

                    <div className="mt-4 flex items-center justify-between border-t border-white/55 pt-4">
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/70" />
                        <span className="text-[10px] font-bold uppercase tracking-[.15em] text-slate-400">
                          Analyzed
                        </span>
                      </div>

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
