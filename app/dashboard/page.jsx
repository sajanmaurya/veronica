"use client";

import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();

  return (
    <main className="min-h-[calc(100vh-72px)] overflow-hidden bg-white/25 backdrop-blur-[2px]">
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-14 sm:px-8 sm:pt-20 lg:px-10 lg:pt-24">
        <div className="glass-panel mx-auto max-w-4xl px-5 py-10 text-center sm:px-10 sm:py-14">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <p className="eyebrow">AI food intelligence</p>
            <span className="rounded-full border border-white/70 bg-white/45 px-3 py-1 text-[10px] font-bold text-slate-500 backdrop-blur-xl">
              No account required to scan
            </span>
          </div>

          <h1 className="mt-5 text-[clamp(3.2rem,7vw,6.2rem)] font-semibold leading-[.9] tracking-[-.075em] text-[#17211d]">
            Know what&apos;s
            <br />
            inside your food.
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-[15px] leading-7 text-slate-500 sm:text-base">
            Scan a barcode or photograph a food label. Veronica turns the
            fine print into clear nutrition, ingredient and food-safety insights — in seconds.
          </p>

          <div className="mt-9 grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
            <button
              onClick={() => router.push("/dashboard/ImageUpload")}
              className="group relative min-h-[82px] overflow-hidden rounded-2xl border-2 border-emerald-600 bg-gradient-to-br from-emerald-600 to-emerald-500 px-7 py-5 text-left text-white shadow-[0_16px_35px_rgba(8,121,95,.28)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_20px_42px_rgba(8,121,95,.34)] focus:outline-none focus:ring-4 focus:ring-emerald-300/50"
            >
              <span className="absolute -right-6 -top-8 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
              <span className="relative flex items-center justify-between gap-4">
                <span>
                  <span className="block text-lg font-extrabold tracking-[-.02em] sm:text-xl">
                    Read the label
                  </span>
                  <span className="mt-1 block text-xs font-medium text-emerald-50">
                    Photograph nutrition & ingredients
                  </span>
                </span>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20 text-xl font-bold ring-1 ring-white/30">
                  →
                </span>
              </span>
            </button>

            <button
              onClick={() => router.push("/dashboard/BarcodeScanning")}
              className="group relative min-h-[82px] overflow-hidden rounded-2xl border-2 border-slate-900 bg-slate-900 px-7 py-5 text-left text-white shadow-[0_16px_35px_rgba(15,23,42,.22)] transition duration-200 hover:-translate-y-1 hover:bg-slate-800 hover:shadow-[0_20px_42px_rgba(15,23,42,.28)] focus:outline-none focus:ring-4 focus:ring-slate-300/60"
            >
              <span className="absolute -right-6 -top-8 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
              <span className="relative flex items-center justify-between gap-4">
                <span>
                  <span className="block text-lg font-extrabold tracking-[-.02em] sm:text-xl">
                    Scan barcode
                  </span>
                  <span className="mt-1 block text-xs font-medium text-slate-300">
                    Point camera · Auto-detect
                  </span>
                </span>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-lg ring-1 ring-white/25">
                  ▦
                </span>
              </span>
            </button>
          </div>
          <p className="mt-4 text-center text-[11px] font-semibold text-slate-400">
            Free to try · Scan instantly · Your account is only needed for saved history and profile features
          </p>
        </div>

        <div className="relative mx-auto mt-14 max-w-5xl">
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-200/35 blur-[100px]" />

          <div className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/45 p-2 shadow-[0_30px_90px_rgba(27,55,44,.12)] backdrop-blur-2xl sm:p-3">
            <div className="grid overflow-hidden rounded-[1.5rem] border border-white/55 bg-white/30 md:grid-cols-[.82fr_1.18fr]">
              <div className="relative min-h-[300px] overflow-hidden sm:min-h-[390px]">
                <img
                  src="/back.png"
                  alt="Food product"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-white/10" />
                <div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-white/60 bg-white/55 px-4 py-3 shadow-[0_12px_30px_rgba(20,45,35,.12)] backdrop-blur-2xl">
                  <p className="text-[9px] font-bold uppercase tracking-[.16em] text-emerald-700">
                    Example scan
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    From barcode to clear answers.
                  </p>
                </div>
              </div>

              <div className="flex flex-col justify-center bg-white/20 p-6 sm:p-9">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">
                      Example result
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      Chocolate Oat Bar
                    </p>
                  </div>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50/80 px-3 py-1.5 text-xs font-extrabold text-emerald-700">
                    82 / 100
                  </span>
                </div>

                <p className="mt-2 text-xs font-medium text-emerald-700">
                  Good choice · Here's why
                </p>

                <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {[
                    ["240", "Calories"],
                    ["6 g", "Sugar"],
                    ["8 g", "Protein"],
                    ["120 mg", "Sodium"],
                  ].map(([value, label]) => (
                    <div
                      key={label}
                      className="rounded-2xl border border-white/70 bg-white/50 px-3 py-3.5 shadow-[0_8px_24px_rgba(20,45,35,.06)] backdrop-blur-xl"
                    >
                      <p className="text-lg font-semibold tracking-[-.03em] text-slate-900">
                        {value}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-500">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/65 px-3 py-2.5 text-xs text-emerald-800">
                    <span className="font-bold">✓ Good protein</span>
                    <span className="block mt-0.5 text-[10px] text-emerald-700">8g per serving</span>
                  </div>
                  <div className="rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2.5 text-xs text-amber-800">
                    <span className="font-bold">⚠ Added sugar</span>
                    <span className="block mt-0.5 text-[10px] text-amber-700">Worth checking</span>
                  </div>
                </div>

                <div className="mt-5 border-t border-white/70 pt-5">
                  <p className="text-xs font-medium text-slate-500">
                    Key ingredients
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {["Whole grain", "Cocoa", "Milk", "Cane sugar"].map(
                      (item) => (
                        <span
                          key={item}
                          className="rounded-full border border-white/70 bg-white/50 px-2.5 py-1.5 text-[10px] text-slate-600 backdrop-blur-xl"
                        >
                          {item}
                        </span>
                      )
                    )}
                  </div>
                </div>

                <p className="mt-5 text-xs font-semibold text-slate-500">
                  Veronica explains the <span className="text-slate-800">why</span>, not just the number.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-20 max-w-5xl">
          <div className="text-center">
            <p className="eyebrow">How Veronica works</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-.05em] text-[#17211d] sm:text-4xl">
              Scan. Analyze. Understand.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">
              Three simple steps turn confusing food labels into information you can actually use.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              ["01", "Scan", "Point your camera at a barcode or photograph the food label."],
              ["02", "Analyze", "Veronica reads the nutrition facts and ingredient list."],
              ["03", "Understand", "Get clear nutrition, ingredient and warning insights."],
            ].map(([number, title, description]) => (
              <div
                key={number}
                className="glass-panel rounded-[1.5rem] p-6 text-center"
              >
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-xs font-extrabold text-white shadow-lg shadow-emerald-600/20">
                  {number}
                </span>
                <h3 className="mt-4 text-lg font-bold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-20 max-w-5xl">
          <div className="text-center">
            <p className="eyebrow">What Veronica checks</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-.05em] text-[#17211d] sm:text-4xl">
              Everything important, in one scan.
            </h2>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Nutrition", "Calories, sugar, fat, protein, fiber and sodium."],
              ["Ingredients", "See the ingredients and understand what is inside."],
              ["Additives", "Surface ingredients and values worth checking."],
              ["Allergens", "Highlight allergen information when it is available."],
              ["Your profile", "Use saved preferences for more relevant insights."],
              ["History", "Keep your analyzed products together in one place."],
            ].map(([title, description]) => (
              <div
                key={title}
                className="glass-surface rounded-[1.5rem] p-5"
              >
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_5px_rgba(16,185,129,.10)]" />
                  <h3 className="font-bold text-slate-900">{title}</h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-500">{description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 text-center">
          <p className="text-sm font-bold uppercase tracking-[.18em] text-emerald-700">
            Scan · Understand · Choose
          </p>
          <p className="mx-auto mt-3 max-w-md text-xs leading-5 text-slate-400">
            Clear information from the label, without the noise.
          </p>
        </div>
      </section>
    </main>
  );
}