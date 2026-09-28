"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();

  return (
    <main className="min-h-[calc(100vh-72px)] overflow-hidden">
      <section className="mx-auto flex min-h-[calc(100vh-72px)] max-w-6xl items-center px-5 py-12 sm:px-8 lg:px-10">
        <div className="relative mx-auto w-full max-w-5xl overflow-hidden rounded-[2.5rem] border border-white/75 bg-white/40 px-6 py-14 text-center shadow-[0_30px_100px_rgba(6,59,47,.10)] backdrop-blur-2xl sm:px-12 sm:py-20 lg:px-20 lg:py-24">
          <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#9BE7B5]/25 blur-[90px]" />

          <div className="relative">
            <button
              type="button"
              onClick={() => router.push("/UserProfile")}
              aria-label="Open Veronica profile"
              className="mx-auto block rounded-[1.35rem] p-1 transition duration-200 hover:scale-[1.03] focus:outline-none focus:ring-4 focus:ring-[#7DD9A5]/40"
            >
              <Image
                src="/veronica-logo.svg"
                alt="Veronica"
                width={72}
                height={72}
                className="brand-mark-glow h-[72px] w-[72px]"
                priority
              />
            </button>

            <p className="mt-7 text-[11px] font-bold uppercase tracking-[.24em] text-[#0B5F4A]">
              AI food intelligence
            </p>

            <h1 className="mx-auto mt-5 max-w-4xl text-[clamp(3rem,7vw,6.6rem)] font-semibold leading-[.94] tracking-[-.065em] text-[#10241E]">
              Know what&apos;s
              <br />
              inside your food.
            </h1>

            <p className="mx-auto mt-7 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              Scan a barcode or photograph a food label. Veronica turns the
              fine print into clear, useful answers.
            </p>

            <div className="mx-auto mt-10 flex max-w-xl flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => router.push("/dashboard/ImageUpload")}
                className="inline-flex min-h-14 flex-1 items-center justify-center rounded-2xl bg-[#0B5F4A] px-7 text-sm font-bold text-white shadow-[0_14px_30px_rgba(11,95,74,.20)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#074C3C] hover:shadow-[0_18px_35px_rgba(11,95,74,.25)] focus:outline-none focus:ring-4 focus:ring-[#7DD9A5]/50"
              >
                Read a label
                <span className="ml-2 text-base">→</span>
              </button>

              <button
                type="button"
                onClick={() => router.push("/dashboard/BarcodeScanning")}
                className="inline-flex min-h-14 flex-1 items-center justify-center rounded-2xl border border-[#0B5F4A]/20 bg-white/65 px-7 text-sm font-bold text-[#0B5F4A] shadow-sm backdrop-blur-xl transition duration-200 hover:-translate-y-0.5 hover:bg-white/85 focus:outline-none focus:ring-4 focus:ring-[#7DD9A5]/40"
              >
                Scan a barcode
              </button>
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] font-semibold text-slate-500">
              <span>No account needed to scan</span>
              <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:block" />
              <span>Save results with an account</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
