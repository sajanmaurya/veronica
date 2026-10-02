"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";

const links = [
  ["/home", "Home"],
  ["/dashboard/ImageUpload", "Analyze"],
  ["/dashboard/BarcodeScanning", "Scan"],
  ["/PreviousSearches", "History"],
  ["/UserProfile", "Profile"],
];

export default function Header({ clerkEnabled = true }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-6">
      <div className="relative mx-auto max-w-6xl rounded-[1.5rem] border border-white/75 bg-white/55 px-3 py-2 shadow-[0_10px_35px_rgba(6,59,47,.08)] backdrop-blur-2xl sm:rounded-full">
        <div className="flex items-center justify-between">
          <Link
            href="/UserProfile"
            className="flex items-center gap-2.5 px-1.5 sm:px-2"
            onClick={() => setMenuOpen(false)}
          >
            <Image
              src="/veronica-brand.svg"
              alt="Veronica"
              width={40}
              height={40}
              className="h-9 w-9 object-contain sm:h-10 sm:w-10"
              priority
            />
            <span className="font-mono text-sm font-bold tracking-[.12em] text-slate-800">
              VERONICA
            </span>
          </Link>

          <nav className="hidden items-center gap-1 sm:flex">
            {links.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className={`rounded-full px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[.12em] transition ${
                  pathname === href
                    ? "bg-[#0B5F4A] text-white shadow-[0_5px_16px_rgba(11,95,74,.18)]"
                    : "text-slate-500 hover:bg-white/70 hover:text-[#0B5F4A]"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {clerkEnabled ? (
              <>
                <SignedOut>
                  <SignInButton mode="modal">
                    <button className="hidden glass-button-primary px-3.5 py-2 font-mono text-[11px] font-bold uppercase tracking-[.08em] sm:inline-flex">
                      Log in
                    </button>
                  </SignInButton>
                </SignedOut>
                <SignedIn>
                  <div className="hidden rounded-full border border-white/80 bg-white/60 p-1 sm:block">
                    <UserButton afterSignOutUrl="/" />
                  </div>
                </SignedIn>
              </>
            ) : null}

            <button
              type="button"
              aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/80 bg-white/65 text-[#0B5F4A] shadow-sm transition hover:bg-white/85 sm:hidden"
            >
              {menuOpen ? (
                <span className="text-xl leading-none">×</span>
              ) : (
                <span className="flex flex-col gap-1.5">
                  <span className="h-0.5 w-4 rounded-full bg-current" />
                  <span className="h-0.5 w-4 rounded-full bg-current" />
                  <span className="h-0.5 w-4 rounded-full bg-current" />
                </span>
              )}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="mt-2 border-t border-white/60 pt-2 sm:hidden">
            <div className="grid gap-1 pb-1">
              {links.map(([href, label]) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center justify-between rounded-xl px-4 py-3 font-mono text-xs font-bold uppercase tracking-[.1em] transition ${
                    pathname === href
                      ? "bg-[#0B5F4A] text-white shadow-sm"
                      : "text-slate-700 hover:bg-white/70 hover:text-[#0B5F4A]"
                  }`}
                >
                  <span>{label}</span>
                  <span className="text-base opacity-60">›</span>
                </Link>
              ))}
            </div>

            {clerkEnabled ? (
              <>
                <SignedOut>
                  <SignInButton mode="modal">
                    <button
                      onClick={() => setMenuOpen(false)}
                      className="glass-button-primary mb-1 mt-1 w-full py-2.5 font-mono text-xs font-bold uppercase tracking-[.08em]"
                    >
                      Log in
                    </button>
                  </SignInButton>
                </SignedOut>
                <SignedIn>
                  <div className="mt-1 flex items-center justify-between rounded-xl border border-white/70 bg-white/45 px-4 py-2.5">
                    <span className="text-xs font-semibold text-slate-600">
                      Account
                    </span>
                    <UserButton afterSignOutUrl="/" />
                  </div>
                </SignedIn>
              </>
            ) : null}
          </nav>
        )}
      </div>
    </header>
  );
}