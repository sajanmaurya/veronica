"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/UserProfile", label: "Profile" },
  { href: "/PreviousSearches", label: "History" },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 px-3 py-3 sm:px-6">
      <div className="glass-surface mx-auto flex max-w-7xl items-center justify-between gap-3 rounded-[1.65rem] px-3 py-2 sm:px-4">
        <Link href="/dashboard" className="flex items-center gap-2.5 rounded-xl px-1.5 py-1 transition hover:opacity-80" aria-label="Veronica dashboard">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-lg font-black text-white shadow-lg shadow-emerald-900/20">V</span>
          <span className="hidden text-base font-bold tracking-[.13em] text-slate-800 sm:block">VERONICA</span>
        </Link>

        <nav aria-label="Primary navigation" className="glass-surface flex items-center gap-1 rounded-full p-1">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link key={link.href} href={link.href} className={`rounded-full px-3 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm ${active ? "bg-emerald-700 text-white shadow-sm shadow-emerald-900/20" : "text-slate-600 hover:bg-white/70 hover:text-emerald-800"}`}>
                {link.label}
              </Link>
            );
          })}
        </nav>

        <SignedOut>
          <SignInButton mode="modal">
            <button className="glass-button-primary px-3 py-2 text-xs sm:px-4 sm:text-sm">Log in</button>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          <div className="glass-surface rounded-full p-1"><UserButton afterSignOutUrl="/" /></div>
        </SignedIn>
      </div>
    </header>
  );
}