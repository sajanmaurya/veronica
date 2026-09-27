"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";

const links = [
  { href: "/dashboard", label: "Home", icon: "⌂" },
  { href: "/dashboard/ImageUpload", label: "Analyze label", icon: "⌕" },
  { href: "/dashboard/BarcodeScanning", label: "Scan barcode", icon: "◫" },
  { href: "/PreviousSearches", label: "Your activity", icon: "◷" },
  { href: "/UserProfile", label: "Profile", icon: "◌" },
];

export default function Header() {
  const pathname = usePathname();
  return (
    <>
      <aside className="glass-surface fixed inset-y-6 left-6 z-40 hidden w-[18rem] flex-col rounded-[2rem] p-5 lg:flex">
        <Link href="/dashboard" className="mb-10 flex items-center gap-3 px-2">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-300 via-lime-400 to-emerald-600 text-xl font-black text-white shadow-lg">V</span>
          <span className="text-xl font-semibold tracking-[-.04em] text-white drop-shadow">Veronica</span>
        </Link>
        <nav className="space-y-1" aria-label="Primary navigation">
          {links.map((link) => {
            const active = pathname === link.href;
            return <Link key={link.href} href={link.href} className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${active ? "bg-white/25 text-white shadow-sm ring-1 ring-white/25" : "text-white/80 hover:bg-white/15 hover:text-white"}`}><span className="w-5 text-lg">{link.icon}</span>{link.label}</Link>;
          })}
        </nav>
        <div className="mt-auto flex items-center justify-between border-t border-white/20 pt-5">
          <span className="text-xs text-white/65">Personal nutrition AI</span>
          <SignedOut><SignInButton mode="modal"><button className="rounded-xl bg-white/20 px-3 py-2 text-xs font-semibold text-white hover:bg-white/30">Log in</button></SignInButton></SignedOut>
          <SignedIn><UserButton afterSignOutUrl="/" /></SignedIn>
        </div>
      </aside>
      <header className="sticky top-0 z-40 px-3 py-3 lg:hidden">
        <div className="glass-surface flex items-center justify-between rounded-2xl px-3 py-2">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm font-bold text-slate-800"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-300 to-emerald-600 text-white">V</span> Veronica</Link>
          <nav className="flex gap-1">{links.slice(0, 3).map((link) => <Link key={link.href} href={link.href} className={`rounded-xl px-2 py-2 text-xs ${pathname === link.href ? "bg-white/40 text-slate-900" : "text-slate-700"}`}>{link.icon}</Link>)}</nav>
        </div>
      </header>
    </>
  );
}