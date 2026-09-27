"use client";

import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();

  return (
    <main className="relative min-h-[calc(100vh-82px)] overflow-hidden">
      <div className="pointer-events-none absolute -left-32 top-24 h-72 w-72 rounded-full bg-emerald-300/20 blur-[90px]" />
      <div className="pointer-events-none absolute right-[-120px] top-40 h-96 w-96 rounded-full bg-cyan-200/25 blur-[110px]" />

      <section className="mx-auto flex min-h-[calc(100vh-82px)] max-w-7xl items-center px-4 py-8 sm:px-8 lg:px-12">
        <div className="grid w-full items-center gap-8 lg:grid-cols-[.92fr_1.08fr] lg:gap-6">

          <div className="relative z-10 max-w-2xl pb-4 lg:pb-0">
            <div className="mb-7 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-gradient-to-br from-lime-300 via-emerald-400 to-emerald-700 text-xl font-black text-white shadow-[0_10px_30px_rgba(8,121,95,.25)]">
                V
              </div>
              <div>
                <p className="text-[11px] font-bold tracking-[.22em] text-slate-700">
                  VERONICA
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Food intelligence
                </p>
              </div>
            </div>

            <h1 className="max-w-xl text-[clamp(3.5rem,7.5vw,7rem)] font-semibold leading-[.88] tracking-[-.075em] text-slate-900">
              Eat with
              <br />
              <span className="text-emerald-700">clarity.</span>
            </h1>

            <p className="mt-7 max-w-lg text-[15px] leading-7 text-slate-600 sm:text-base">
              Point Veronica at a food label. We&apos;ll turn the small print
              into nutrition, ingredients, and practical insights.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={() => router.push("/dashboard/ImageUpload")}
                className="glass-button-primary px-6 py-4 text-[15px]"
              >
                Analyze a product
                <span className="ml-2 text-lg">↗</span>
              </button>

              <button
                onClick={() => router.push("/dashboard/BarcodeScanning")}
                className="glass-button-secondary px-5 py-4 text-[15px]"
              >
                Scan barcode
              </button>
            </div>

            <div className="mt-8 flex items-center gap-5 text-[11px] font-medium text-slate-500">
              <span>Nutrition</span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span>Ingredients</span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span>Your profile</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[620px] lg:justify-self-end">
            <div className="relative aspect-[.92/1] sm:aspect-[1.08/1]">

              <div className="absolute inset-[7%_5%_3%_9%] overflow-hidden rounded-[3rem] border border-white/70 bg-white/25 p-2 shadow-[0_35px_100px_rgba(20,45,35,.18)] backdrop-blur-xl">
                <div className="relative h-full overflow-hidden rounded-[2.45rem]">
                  <img
                    src="/back.png"
                    alt="Food"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/30 via-transparent to-white/10" />
                </div>
              </div>

              <div className="glass-surface absolute left-0 top-[13%] w-[180px] rounded-[1.5rem] p-4 shadow-[0_20px_50px_rgba(20,45,35,.14)] sm:w-[205px]">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-bold uppercase tracking-[.16em] text-slate-500">
                    Nutrition
                  </p>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,.7)]" />
                </div>
                <div className="mt-3 flex items-end gap-1">
                  <span className="text-3xl font-semibold tracking-[-.05em] text-slate-900">
                    240
                  </span>
                  <span className="pb-1 text-[11px] text-slate-500">kcal</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-white/55 p-2">
                    <p className="text-[9px] text-slate-500">Protein</p>
                    <p className="mt-0.5 text-xs font-semibold text-slate-800">8 g</p>
                  </div>
                  <div className="rounded-xl bg-white/55 p-2">
                    <p className="text-[9px] text-slate-500">Sugar</p>
                    <p className="mt-0.5 text-xs font-semibold text-slate-800">6 g</p>
                  </div>
                </div>
              </div>

              <div className="glass-surface absolute bottom-[9%] right-0 w-[190px] rounded-[1.5rem] p-4 shadow-[0_20px_50px_rgba(20,45,35,.14)] sm:w-[220px]">
                <p className="text-[9px] font-bold uppercase tracking-[.16em] text-emerald-700">
                  Ingredients
                </p>
                <p className="mt-2 text-sm font-semibold leading-5 text-slate-800">
                  What&apos;s actually inside?
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {["Sugar", "Milk", "Cocoa"].map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-white/65 px-2.5 py-1 text-[10px] font-medium text-slate-600"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="glass-surface absolute right-[7%] top-[3%] flex h-12 w-12 items-center justify-center rounded-full shadow-[0_15px_35px_rgba(20,45,35,.14)] sm:h-14 sm:w-14">
                <span className="text-lg font-semibold text-emerald-700">V</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="pointer-events-none absolute bottom-4 left-1/2 hidden -translate-x-1/2 text-center lg:block">
        <p className="text-[9px] font-bold uppercase tracking-[.2em] text-slate-400">
          Understand your food
        </p>
      </div>
    </main>
  );
}