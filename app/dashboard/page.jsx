"use client";

import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();

  return (
    <main className="app-canvas">
      <section className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.02fr_.98fr]">
        <div className="max-w-2xl">
          <p className="eyebrow"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Your nutrition copilot</p>
          <h1 className="mt-6 text-5xl font-semibold tracking-[-.06em] text-slate-900 sm:text-6xl lg:text-7xl">
            Food clarity,<br /><span className="text-emerald-700">at a glance.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">
            Veronica turns product labels and barcodes into calm, useful nutrition guidance—personalized to the health details you choose to share.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <button onClick={() => router.push("/dashboard/BarcodeScanning")} className="glass-button-primary px-6 py-4 text-base">Scan a barcode <span className="ml-2">→</span></button>
            <button onClick={() => router.push("/dashboard/ImageUpload")} className="glass-button-secondary px-6 py-4 text-base">Analyze a label</button>
          </div>
          <p className="mt-5 text-sm text-slate-500">Private by design · Clear, practical insights</p>
        </div>

        <div className="relative mx-auto w-full max-w-xl">
          <div className="absolute -left-8 top-10 h-36 w-36 rounded-full bg-emerald-300/30 blur-3xl" />
          <div className="absolute -right-5 bottom-4 h-48 w-48 rounded-full bg-sky-200/40 blur-3xl" />
          <div className="glass-panel relative overflow-hidden p-3 sm:p-4">
            <img src="/back.png" alt="Fresh food and nutrition" className="aspect-[4/3] w-full rounded-[1.45rem] object-cover" />
            <div className="glass-surface absolute bottom-7 left-7 rounded-2xl px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-emerald-700">Veronica intelligence</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">Ready when you are</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}