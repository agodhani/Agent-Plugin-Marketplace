import Link from "next/link";
import { Compass, ListChecks } from "lucide-react";
import { PaletteButton } from "@/components/palette-button";

export default function NotFound() {
  return (
    <div className="flex justify-center py-10">
      <section className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-gradient-to-b from-indigo-950 via-slate-950 to-slate-950 px-8 py-14 text-center shadow-2xl shadow-indigo-950/30 ring-1 ring-white/10">
        <div aria-hidden className="aurora aurora-a absolute -left-20 -top-20 h-64 w-64 rounded-full bg-indigo-600/45 blur-3xl" />
        <div aria-hidden className="aurora aurora-b absolute -bottom-20 -right-16 h-56 w-56 rounded-full bg-fuchsia-600/35 blur-3xl" />
        <div aria-hidden className="hero-grid absolute inset-0" />
        <div aria-hidden className="hero-noise absolute inset-0 opacity-[0.05]" />

        <div className="relative">
          <p className="enter text-[11px] font-semibold uppercase tracking-widest text-indigo-300/80" style={{ ["--i" as string]: 0 }}>
            Error 404
          </p>
          <h1 className="enter mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl" style={{ ["--i" as string]: 1 }}>
            This page wandered off
          </h1>
          <p className="enter mx-auto mt-3 max-w-md text-sm leading-relaxed text-indigo-200/80" style={{ ["--i" as string]: 2 }}>
            The item you&apos;re looking for isn&apos;t in the catalog — it may have been renamed, removed, or never approved.
          </p>
          <div className="enter mt-7 flex flex-wrap items-center justify-center gap-4" style={{ ["--i" as string]: 3 }}>
            <PaletteButton>Open search…</PaletteButton>
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-200 underline-offset-4 transition hover:text-white hover:underline">
              <Compass className="h-4 w-4" /> Browse catalog
            </Link>
            <Link href="/playbooks" className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-200 underline-offset-4 transition hover:text-white hover:underline">
              <ListChecks className="h-4 w-4" /> Playbooks
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
