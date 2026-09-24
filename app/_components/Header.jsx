"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";

const Header = () => {
  const pathname = usePathname();

  return (
    <header className="border-b border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-teal-50 shadow-[0_10px_30px_rgba(16,185,129,0.08)]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-200">
            <span className="text-xl font-black text-white">V</span>
          </div>
          <div className="text-2xl font-black tracking-wide text-emerald-700">VERONICA</div>
        </div>

        <nav className="flex flex-wrap items-center gap-2 rounded-full bg-white/80 p-2 shadow-inner ring-1 ring-slate-200 backdrop-blur-sm">
          <Link
            href="/dashboard"
            className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
              pathname === "/dashboard"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-200"
                : "text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
            }`}
          >
            Dashboard
          </Link>
          <Link
            href="/UserProfile"
            className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
              pathname === "/UserProfile"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-200"
                : "text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
            }`}
          >
            Profile
          </Link>
          <Link
            href="/PreviousSearches"
            className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
              pathname === "/PreviousSearches"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-200"
                : "text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
            }`}
          >
            Previous Searches
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition hover:scale-[1.02] hover:shadow-blue-300">
                Log In
              </button>
            </SignInButton>
          </SignedOut>

          <SignedIn>
            <div className="rounded-full border border-emerald-200 bg-white p-1 shadow-sm">
              <UserButton afterSignOutUrl="/" />
            </div>
          </SignedIn>
        </div>
      </div>
    </header>
  );
};

export default Header;
