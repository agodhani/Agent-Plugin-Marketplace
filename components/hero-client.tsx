"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { useCommandPalette } from "./command-palette";
import { useIsMac } from "./use-is-mac";

/** Counts up to `value` when scrolled into view (rAF, ~1.2s ease-out). */
export function NumberTicker({ value, className = "" }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(value);
      return;
    }
    let raf = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        const duration = 1200;
        let start: number | null = null;
        const tick = (t: number) => {
          if (start === null) start = t;
          const p = Math.min(1, (t - start) / duration);
          const eased = 1 - Math.pow(1 - p, 3);
          setDisplay(Math.round(value * eased));
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [value]);

  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {new Intl.NumberFormat("en-US").format(display)}
    </span>
  );
}

const AGENTS = ["Claude Code", "Cursor", "Amp", "Devin", "Codex", "Copilot", "Windsurf"];

/** Rotating agent-name chip — vertical slide every ~2.2s. */
export function AgentRotator() {
  const [i, setI] = useState(0);
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const t = setInterval(() => setI((v) => (v + 1) % AGENTS.length), 2200);
    return () => clearInterval(t);
  }, [reduced]);

  if (reduced) return <span className="font-semibold text-indigo-200">any agent</span>;

  const prev = (i - 1 + AGENTS.length) % AGENTS.length;
  return (
    <>
      <span className="sr-only">{AGENTS.join(", ")} — any agent</span>
      <span
        aria-hidden="true"
        data-testid="agent-chip"
        className="inline-grid overflow-hidden whitespace-nowrap rounded-md border border-white/15 bg-white/5 px-2 align-bottom"
      >
        {AGENTS.map((a, idx) => (
          <span
            key={a}
            className={`col-start-1 row-start-1 whitespace-nowrap font-semibold text-indigo-200 transition-all duration-500 ease-[cubic-bezier(.2,.7,.2,1)] ${
              idx === i
                ? "translate-y-0 opacity-100"
                : idx === prev
                  ? "-translate-y-2 opacity-0"
                  : "translate-y-2 opacity-0"
            }`}
          >
            {a}
          </span>
        ))}
      </span>
    </>
  );
}

export function HeroCtas() {
  const { open } = useCommandPalette();
  const isMac = useIsMac();
  return (
    <div className="mt-8 flex flex-wrap items-center gap-4">
      <button
        type="button"
        onClick={open}
        className="group inline-flex items-center gap-3 rounded-xl bg-white px-5 py-3.5 text-sm font-semibold text-slate-900 shadow-lg shadow-indigo-950/40 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-900/40"
      >
        <Search className="h-4 w-4 text-slate-400 transition group-hover:text-indigo-600" />
        Search the catalog…
        <kbd className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-[11px] font-medium text-slate-500">
          {isMac ? "⌘K" : "Ctrl K"}
        </kbd>
      </button>
      <Link
        href="/playbooks"
        className="text-sm font-medium text-indigo-200 underline-offset-4 transition hover:text-white hover:underline"
      >
        Browse playbooks
      </Link>
      <Link
        href="/submit"
        className="text-sm font-medium text-indigo-200 underline-offset-4 transition hover:text-white hover:underline"
      >
        Submit a plugin
      </Link>
    </div>
  );
}
