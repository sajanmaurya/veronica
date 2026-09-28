"use client";

import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();

  return (
    <main className="min-h-[calc(100vh-72px)] overflow-hidden bg-[#050505] text-white">
      <section className="mx-auto flex min-h-[calc(100vh-72px)] max-w-6xl items-center px-5 py-12 sm:px-8 lg:px-10">
        <div className="relative mx-auto w-full max-w-5xl overflow-hidden rounded-[2.5rem] border border-white/10 bg-black/90 px-6 py-14 text-center shadow-[0_30px_100px_rgba(0,0,0,.55)] backdrop-blur-2xl sm:px-12 sm:py-20 lg:px-20 lg:py-24">
          <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#E10600]/20 blur-[90px]" />

          <div className="relative">
            <p className="ndot57-home mt-7 text-[10px] uppercase tracking-[.08em] text-[#FF2A20]">
              AI food intelligence
            </p>

            <h1 className="ndot57-home mx-auto mt-5 max-w-5xl text-[clamp(2.5rem,6.2vw,6rem)] leading-[1.05] text-white">
              Know what&apos;s
              <br />
              inside your food.
            </h1>

            <p className="ndot57-home mx-auto mt-7 max-w-2xl text-base leading-7 sm:text-lg">
              Scan a barcode or photograph a food label. Veronica turns the
              fine print into clear, useful answers.
            </p>

            <div className="mx-auto mt-10 flex max-w-xl flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => router.push("/dashboard/ImageUpload")}
                className="ndot57-home inline-flex min-h-14 flex-1 items-center justify-center rounded-2xl bg-[#E10600] px-7 text-sm text-white shadow-[0_14px_30px_rgba(225,6,0,.22)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#B80500] hover:shadow-[0_18px_35px_rgba(225,6,0,.30)] focus:outline-none focus:ring-4 focus:ring-[#FF2A20]/40"
              >
                Read a label
                <span className="ml-2 text-base">→</span>
              </button>

              <button
                type="button"
                onClick={() => router.push("/dashboard/BarcodeScanning")}
                className="ndot57-home inline-flex min-h-14 flex-1 items-center justify-center rounded-2xl border border-[#E10600]/30 bg-black px-7 text-sm text-[#0B5F4A] shadow-sm backdrop-blur-xl transition duration-200 hover:-translate-y-0.5 hover:bg-[#171717] focus:outline-none focus:ring-4 focus:ring-[#FF2A20]/35"
              >
                Scan a barcode
              </button>
            </div>

            <div className="ndot57-home mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[10px] text-white/55">
              <span>No account needed to scan</span>
              <span className="hidden h-1 w-1 rounded-full bg-white/20 sm:block" />
              <span>Save results with an account</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
