"use client";

import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();

  return (
    <main className="min-h-[calc(100vh-72px)] overflow-hidden">
      <section className="mx-auto flex min-h-[calc(100vh-72px)] max-w-6xl items-center px-4 py-8 sm:px-8 lg:px-10">
        <div className="relative mx-auto w-full max-w-5xl overflow-hidden rounded-[2.35rem] border border-white/75 bg-[rgba(225,236,240,.28)] px-5 py-10 text-center shadow-[0_24px_70px_rgba(9,43,78,.10)] backdrop-blur-[30px] sm:px-12 sm:py-16 lg:px-20 lg:py-20">
          <div className="pointer-events-none absolute left-[24%] top-[8%] h-56 w-56 rounded-full bg-emerald-300/15 blur-[90px]" />
          <div className="pointer-events-none absolute right-[18%] top-[12%] h-64 w-64 rounded-full bg-blue-400/15 blur-[100px]" />

          <div className="relative">
            <p className="ndot57-home mt-2 text-[10px] uppercase tracking-[.08em] text-[#0C6D73]">
              AI food intelligence
            </p>

            <h1 className="ndot57-home mx-auto mt-5 max-w-5xl text-[clamp(2.5rem,6.2vw,6rem)] leading-[1.05] text-black">
              Know what&apos;s
              <br />
              inside your food.
            </h1>

            <p className="ndot57-home mx-auto mt-7 max-w-2xl text-base leading-7 text-slate-700 sm:text-lg">
              Scan a barcode or photograph a food label. Veronica turns the
              fine print into clear, useful answers.
            </p>

            <div className="mx-auto mt-10 grid max-w-2xl gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => router.push("/dashboard/BarcodeScanning")}
                className="ndot57-home home-cta-primary inline-flex min-h-14 items-center justify-center rounded-2xl px-7 text-sm transition duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-blue-300/35"
              >
                <span className="mr-2 text-base">⌁</span>
                Open Camera Scanner
              </button>

              <button
                type="button"
                onClick={() => router.push("/dashboard/ImageUpload")}
                className="ndot57-home home-cta-secondary inline-flex min-h-14 items-center justify-center rounded-2xl px-7 text-sm transition duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-blue-200/45"
              >
                <span className="mr-2 text-base">↑</span>
                Upload Food Label
              </button>
            </div>

            <div className="ndot57-home mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[10px] text-slate-500">
              <span>Barcode → product data</span>
              <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:block" />
              <span>Label → Vision AI</span>
              <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:block" />
              <span>Save results with an account</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
