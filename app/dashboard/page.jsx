"use client";

import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();

  return (
    <main className="min-h-[calc(100vh-72px)] overflow-hidden bg-[#f7f8f4]">
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-14 sm:px-8 sm:pt-20 lg:px-10 lg:pt-24">
        <div className="mx-auto max-w-3xl text-center">
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

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              onClick={() => router.push("/dashboard/ImageUpload")}
              className="glass-button-primary min-w-[190px] px-8 py-4 text-base font-bold shadow-[0_12px_28px_rgba(8,121,95,.24)]"
            >
              Read the label
              <span className="ml-2 text-lg">→</span>
            </button>
            <button
              onClick={() => router.push("/dashboard/BarcodeScanning")}
              className="glass-button-secondary min-w-[190px] border-2 border-emerald-200/80 bg-white/75 px-8 py-4 text-base font-bold text-slate-800 shadow-[0_10px_24px_rgba(20,45,35,.08)]"
            >
              Scan barcode
            </button>
          </div>
        </div>

        <div className="relative mx-auto mt-14 max-w-5xl sm:mt-18">
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-200/35 blur-[90px]" />

          <div className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/65 p-2 shadow-[0_30px_90px_rgba(27,55,44,.12)] backdrop-blur-xl sm:p-3">
            <div className="grid overflow-hidden rounded-[1.5rem] bg-[#edf1eb] md:grid-cols-[.92fr_1.08fr]">
              <div className="relative min-h-[270px] overflow-hidden sm:min-h-[330px]">
                <img
                  src="/back.png"
                  alt="Food"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-white/10" />
                <div className="absolute bottom-5 left-5 rounded-2xl border border-white/50 bg-white/70 px-4 py-3 backdrop-blur-xl">
                  <p className="text-[9px] font-bold uppercase tracking-[.16em] text-emerald-700">
                    Veronica
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    A clearer label starts here.
                  </p>
                </div>
              </div>

              <div className="flex flex-col justify-center p-6 sm:p-9">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">
                    Example analysis
                  </p>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
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
                      className="rounded-2xl bg-white/80 px-3 py-3.5"
                    >
                      <p className="text-lg font-semibold tracking-[-.03em] text-slate-900">
                        {value}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-500">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 border-t border-slate-900/8 pt-5">
                  <p className="text-xs font-medium text-slate-400">
                    Ingredients
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {["Whole grain", "Cocoa", "Milk", "Cane sugar"].map(
                      (item) => (
                        <span
                          key={item}
                          className="rounded-full bg-white px-2.5 py-1.5 text-[10px] text-slate-600"
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