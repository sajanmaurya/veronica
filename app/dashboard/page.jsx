"use client";

import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();

  return (
    <main className="app-canvas">
      <section className="mx-auto flex min-h-[calc(100vh-150px)] max-w-6xl flex-col justify-center px-1 py-10 sm:py-16">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_.82fr] lg:gap-16">
          <div className="max-w-2xl">
            <div className="eyebrow">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Your food, understood
            </div>

            <h1 className="mt-6 text-[clamp(3.2rem,7vw,6.4rem)] font-semibold leading-[.94] tracking-[-.07em] text-slate-900">
              Know what&apos;s
              <br />
              <span className="text-emerald-700">in your food.</span>
            </h1>

            <p className="mt-7 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
              Scan a product or upload its label. Veronica turns the details
              into simple nutrition and ingredient insights you can actually use.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => router.push("/dashboard/ImageUpload")}
                className="glass-button-primary px-6 py-4 text-base"
              >
                Analyze a label
                <span className="ml-2 text-lg">→</span>
              </button>

              <button
                onClick={() => router.push("/dashboard/BarcodeScanning")}
                className="glass-button-secondary px-6 py-4 text-base"
              >
                Scan barcode
              </button>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-slate-500">
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Nutrition facts
              </span>
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Ingredients
              </span>
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Personal context
              </span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:justify-self-end">
            <div className="absolute -left-10 top-8 h-36 w-36 rounded-full bg-emerald-300/25 blur-3xl" />
            <div className="absolute -right-8 bottom-8 h-44 w-44 rounded-full bg-sky-200/30 blur-3xl" />

            <div className="glass-panel relative overflow-hidden p-2.5 shadow-[0_30px_80px_rgba(20,45,35,.16)]">
              <div className="relative overflow-hidden rounded-[1.65rem]">
                <img
                  src="/back.png"
                  alt="Fresh food"
                  className="aspect-[4/4.5] w-full object-cover"
                />

                <div className="absolute inset-x-3 bottom-3">
                  <div className="glass-surface rounded-2xl px-4 py-3.5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[.16em] text-emerald-700">
                          Veronica
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-800">
                          From label to clarity.
                        </p>
                      </div>
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-sm font-bold text-white shadow-md">
                        V
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-14 grid gap-3 border-t border-white/60 pt-5 sm:grid-cols-3 sm:gap-0">
          {[
            ["01", "Scan", "Capture a barcode or food label."],
            ["02", "Understand", "See nutrition and ingredients clearly."],
            ["03", "Decide", "Use the information that matters to you."],
          ].map(([number, title, description]) => (
            <div
              key={number}
              className="flex gap-3 px-1 py-2 sm:px-5 sm:first:pl-0 sm:not-first:border-l sm:not-first:border-white/60"
            >
              <span className="pt-0.5 text-[10px] font-bold tracking-[.14em] text-emerald-700">
                {number}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-800">{title}</p>
                <p className="mt-0.5 text-xs leading-5 text-slate-500">
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}