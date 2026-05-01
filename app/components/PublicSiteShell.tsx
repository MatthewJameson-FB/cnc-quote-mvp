import Link from "next/link";
import type { ReactNode } from "react";

const navItems = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/examples", label: "Examples" },
  { href: "/for-garages", label: "For garages" },
  { href: "/about", label: "About us" },
];

export default function PublicSiteShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#050b14] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(53,96,156,0.18),_transparent_34%),radial-gradient(circle_at_80%_20%,_rgba(223,87,57,0.12),_transparent_28%),linear-gradient(180deg,_rgba(255,255,255,0.02),_transparent_28%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:linear-gradient(180deg,black,transparent_92%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-24 h-px bg-gradient-to-r from-transparent via-slate-200/20 to-transparent" />

      <div className="relative z-10">
        <header className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 rounded-[28px] border border-white/10 bg-white/5 px-4 py-4 backdrop-blur md:flex-row md:items-center md:justify-between md:px-6">
            <Link href="/" className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-gradient-to-br from-slate-100 to-slate-300 text-sm font-black text-slate-950 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
                F
              </span>
              <span>
                <span className="block text-lg font-black tracking-[0.24em] text-white">FLANGIE</span>
                <span className="block text-[11px] uppercase tracking-[0.32em] text-slate-300">Precision parts. Recreated.</span>
              </span>
            </Link>

            <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium text-slate-200">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} className="transition hover:text-white">
                  {item.label}
                </Link>
              ))}
              <Link
                href="/submit-part"
                className="ml-0 inline-flex rounded-full bg-[#f05a3a] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#ff6948] md:ml-2"
              >
                Submit a request
              </Link>
            </nav>
          </div>
        </header>

        <div>{children}</div>
      </div>
    </main>
  );
}
