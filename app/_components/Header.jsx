"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";

const links = [
  ["/home", "Home"],
  ["/dashboard/ImageUpload", "Analyze"],
  ["/dashboard/BarcodeScanning", "Scan"],
  ["/PreviousSearches", "History"],
  ["/UserProfile", "Profile"],
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 px-4 pt-3 sm:px-6">
      <div className="mx-auto flex max-w-6xl items-center justify-between rounded-full border border-white/75 bg-white/55 px-3 py-2 shadow-[0_10px_35px_rgba(20,45,35,.08)] backdrop-blur-2xl">
        <Link href="/home" className="flex items-center gap-2.5 px-2">
          <Image
            src="/veronica-logo.svg"
            alt="Veronica"
            width={36}
            height={36}
            className="h-9 w-9 rounded-[12px] shadow-sm"
            priority
          />
          <span className="text-sm font-bold tracking-[.11em] text-slate-800">
            VERONICA
          </span>
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                pathname === href
                  ? "bg-slate-900 text-white"
                  : "text-slate-500 hover:bg-white/70 hover:text-slate-900"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="glass-button-primary px-3.5 py-2 text-xs">
                Log in
              </button>
            </SignInButton>
          </SignedOut>

          <SignedIn>
            <div className="rounded-full border border-white/80 bg-white/60 p-1">
              <UserButton afterSignOutUrl="/" />
            </div>
          </SignedIn>
        </div>
      </div>
    </header>
  );
}