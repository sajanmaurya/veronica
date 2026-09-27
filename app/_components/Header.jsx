"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
const links=[["/dashboard","Dashboard"],["/dashboard/ImageUpload","Analyze"],["/dashboard/BarcodeScanning","Scan"],["/PreviousSearches","History"],["/UserProfile","Profile"]];
export default function Header(){
 const pathname=usePathname();
 return <header className="sticky top-0 z-40 px-3 py-3 sm:px-6"><div className="glass-surface mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 rounded-[1.65rem] px-3 py-2 sm:px-4">
 <Link href="/dashboard" className="flex items-center gap-2.5 px-1.5 py-1"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-300 via-lime-400 to-emerald-600 text-lg font-black text-white shadow-lg">V</span><span className="hidden text-base font-bold tracking-[.1em] text-slate-800 sm:block">VERONICA</span></Link>
 <nav className="glass-surface order-3 flex w-full items-center justify-center gap-1 rounded-full p-1 sm:order-none sm:w-auto">{links.map(([href,label])=><Link key={href} href={href} className={`rounded-full px-3 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm ${pathname===href?"bg-emerald-700 text-white shadow-sm":"text-slate-600 hover:bg-white/60 hover:text-emerald-800"}`}>{label}</Link>)}</nav>
 <SignedOut><SignInButton mode="modal"><button className="glass-button-primary px-3 py-2 text-xs sm:px-4 sm:text-sm">Log in</button></SignInButton></SignedOut><SignedIn><div className="glass-surface rounded-full p-1"><UserButton afterSignOutUrl="/"/></div></SignedIn>
 </div></header>
}