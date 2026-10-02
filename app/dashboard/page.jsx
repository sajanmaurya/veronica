"use client";

import { useRouter } from "next/navigation";

function ScanIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 3H5a2 2 0 0 0-2 2v2M17 3h2a2 2 0 0 1 2 2v2M7 21H5a2 2 0 0 1-2-2v-2M17 21h2a2 2 0 0 0 2-2v-2" />
      <path d="M7 12h10" />
    </svg>
  );
}

function LabelIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v5h5M10 12h5M10 16h5" />
    </svg>
  );
}

export default function Dashboard() {
  const router = useRouter();

  return (
    <main className="relative min-h-[calc(100vh-72px)] overflow-hidden bg-[#e9eef4] text-[#132238]">
      <div className="pointer-events-none absolute -left-24 top-10 h-80 w-80 rounded-full bg-[#8ec5d6]/45 blur-[110px]" />
      <div className="pointer-events-none absolute right-[-7rem] top-24 h-96 w-96 rounded-full bg-[#b9aeea]/30 blur-[125px]" />
      <div className="pointer-events-none absolute bottom-[-10rem] left-1/3 h-96 w-96 rounded-full bg-[#74b5aa]/30 blur-[120px]" />

      <section className="relative mx-auto flex min-h-[calc(100vh-72px)] max-w-6xl items-center px-4 py-8 sm:px-7 sm:py-12 lg:px-10">
        <div className="w-full">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/65 bg-white/28 px-5 py-7 shadow-[0_24px_80px_rgba(39,55,78,.12)] backdrop-blur-[28px] sm:px-9 sm:py-10 lg:px-12 lg:py-12">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/90" />
            <div className="pointer-events-none absolute right-[-3rem] top-[-3rem] h-44 w-44 rounded-full border border-white/35 bg-white/10" />

            <div className="relative grid gap-8 lg:grid-cols-[1.15fr_.85fr] lg:items-end">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/38 px-3 py-1.5 backdrop-blur-xl">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#287e78]" />
                  <span className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#31536b]">
                    AI food intelligence
                  </span>
                </div>

                <h1 className="mt-5 max-w-3xl text-[clamp(2.6rem,7vw,6.1rem)] font-semibold leading-[.97] tracking-[-.065em] text-[#132238]">
                  Know what&apos;s
                  <br />
                  inside your food.
                </h1>

                <p className="mt-5 max-w-xl text-sm leading-6 text-[#536579] sm:text-base sm:leading-7">
                  Scan a barcode or photograph a food label. Veronica turns
                  ingredients and nutrition data into clear, useful answers.
                </p>
              </div>

              <div className="rounded-[1.6rem] border border-white/60 bg-[#f8fbff]/38 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.8)] backdrop-blur-2xl sm:p-4">
                <p className="px-1 text-[10px] font-semibold uppercase tracking-[.16em] text-[#718095]">
                  Start analyzing
                </p>

                <div className="mt-3 grid gap-2.5">
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/BarcodeScanning")}
                    className="group flex min-h-[4.5rem] items-center gap-3 rounded-[1.15rem] bg-[#182b45] px-4 text-left text-white shadow-[0_12px_28px_rgba(24,43,69,.18)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#102239] active:translate-y-0"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#b9e0dc]">
                      <ScanIcon />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">Scan barcode</span>
                      <span className="mt-0.5 block text-[10px] text-white/60">
                        Fast product lookup
                      </span>
                    </span>
                    <span className="ml-auto text-lg text-white/45 transition group-hover:translate-x-0.5">→</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/ImageUpload")}
                    className="group flex min-h-[4.5rem] items-center gap-3 rounded-[1.15rem] border border-white/70 bg-white/58 px-4 text-left text-[#182b45] shadow-[0_8px_20px_rgba(52,70,92,.06)] backdrop-blur-xl transition duration-200 hover:-translate-y-0.5 hover:bg-white/75 active:translate-y-0"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#dfecef] text-[#287e78]">
                      <LabelIcon />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">Scan food label</span>
                      <span className="mt-0.5 block text-[10px] text-[#718095]">
                        Ingredients + nutrition
                      </span>
                    </span>
                    <span className="ml-auto text-lg text-[#718095] transition group-hover:translate-x-0.5">→</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="relative mt-8 grid gap-2 border-t border-white/45 pt-5 sm:grid-cols-3">
              {[
                ["01", "Barcode lookup", "Product data in seconds"],
                ["02", "Vision analysis", "Read labels with AI"],
                ["03", "Personal history", "Keep past scans together"],
              ].map(([number, title, text]) => (
                <div
                  key={number}
                  className="rounded-[1.1rem] border border-white/45 bg-white/18 px-4 py-3 backdrop-blur-lg"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 text-[9px] font-semibold tracking-[.12em] text-[#287e78]">
                      {number}
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-[#263a52]">{title}</p>
                      <p className="mt-1 text-[10px] leading-4 text-[#748397]">{text}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-4 text-center text-[9px] uppercase tracking-[.16em] text-[#7f8b9a]">
            Understand labels · compare nutrition · make informed choices
          </p>
        </div>
      </section>
    </main>
  );
}
