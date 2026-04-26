"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AppNavigation() {
  const pathname = usePathname();

  if (pathname === "/") {
    return null;
  }

  return (
    <div className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="text-lg font-semibold text-white">
          RealityTwin
        </Link>
        <nav className="flex flex-wrap items-center gap-3">
          <Link
            href="/map"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
          >
            Open Map
          </Link>
          <Link
            href="/simulate"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
          >
            Simulate Route
          </Link>
          <Link
            href="/upload"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
          >
            Upload CSV / Destination
          </Link>
          <Link
            href="/history"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
          >
            View History
          </Link>
          <Link
            href="/ai"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
          >
            AI Insights
          </Link>
        </nav>
      </div>
    </div>
  );
}
