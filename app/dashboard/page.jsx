"use client";

import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();

  return (
    <main className="min-h-[calc(100vh-72px)] overflow-hidden bg-white/25 backdrop-blur-[2px]">
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-14 sm:px-8 sm:pt-20 lg:px-10 lg:pt-24">
        <div className="glass-panel mx-auto max-w-4xl px-5 py-10 text-center sm:px-10 sm:py-14">
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-emerald-700">
            AI food intelligence
          </p>

          <h1 className="mt-5 text-[clamp(3.2rem,7vw,6.2rem)] font-semibold leading-[.9] tracking-[-.075em] text-[#17211d]">
            Know what
            <br />
            you&apos;re eating.
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-[15px] leading-7 text-slate-500 sm:text-base">
            Scan a barcode or photograph a food label. Veronica turns the
            fine print into clear nutrition and ingredient insights.
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
        </div>

        <div className="relative mx-auto mt-14 max-w-5xl sm:mt-18">
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-200/35 blur-[90px]" />

          <div className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/45 p-2 shadow-[0_30px_90px_rgba(27,55,44,.12)] backdrop-blur-2xl sm:p-3">
            <div className="grid overflow-hidden rounded-[1.5rem] border border-white/55 bg-white/30 md:grid-cols-[.92fr_1.08fr]">
              <div className="relative min-h-[270px] overflow-hidden sm:min-h-[330px]">
                <img
                  src="/back.png"
                  alt="Food"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-white/10" />
                <div className="absolute bottom-5 left-5 rounded-2xl border border-white/60 bg-white/55 px-4 py-3 shadow-[0_12px_30px_rgba(20,45,35,.12)] backdrop-blur-2xl">
                  <p className="text-[9px] font-bold uppercase tracking-[.16em] text-emerald-700">
                    Veronica
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    A clearer label starts here.
                  </p>
                </div>
              </div>

              <div className="flex flex-col justify-center bg-white/20 p-6 backdrop-blur-xl sm:p-9">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">
                    Example analysis
                  </p>
                  <span className="rounded-full border border-white/70 bg-white/55 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 backdrop-blur-xl">
                    8.2 / 10
                  </span>
                </div>

                <h2 className="mt-5 text-2xl font-semibold tracking-[-.04em] text-slate-900 sm:text-3xl">
                  Nutrition, without the noise.
                </h2>

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

                <div className="mt-5 border-t border-white/70 pt-5">
                  <p className="text-xs font-medium text-slate-500">
                    Ingredients
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
              </div>
            </div>
          </div>
        </div>

        <p className="mt-7 text-center text-[11px] font-medium text-slate-400">
          Scan · Understand · Choose
        </p>
      </section>
    </main>
  );
}