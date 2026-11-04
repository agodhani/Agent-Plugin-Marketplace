"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";

export interface TerminalItem {
  slug: string;
  name: string;
  version: string;
  risk: string;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function Chrome() {
  return (
    <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5">
      <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
      <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
      <span className="ml-2 text-[10px] font-medium text-slate-500">agenthub — zsh</span>
    </div>
  );
}

function ItemLine({ it, done }: { it: TerminalItem; done: boolean }) {
  return (
    <div className="mt-1.5 flex items-center gap-2">
      {done ? (
        <Check className="h-3 w-3 shrink-0 text-emerald-400" />
      ) : (
        <Loader2 className="h-3 w-3 shrink-0 animate-spin text-indigo-400" />
      )}
      <span className="truncate text-slate-300">
        {it.slug} <span className="text-slate-500">v{it.version} · scanned · {it.risk} risk</span>
      </span>
    </div>
  );
}

export function HeroTerminal({ playbookSlug, items }: { playbookSlug: string; items: TerminalItem[] }) {
  const reduced = useReducedMotion();
  const cmd = `agenthub playbook install ${playbookSlug}`;

  const [typed, setTyped] = useState(0);
  const [shown, setShown] = useState(0); // lines visible (spinner or check)
  const [resolved, setResolved] = useState(0); // lines showing a check
  const [done, setDone] = useState(false);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const timers: number[] = [];
    const at = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms));
    let t = 0;
    for (let c = 1; c <= cmd.length; c++) {
      const n = c;
      at(() => setTyped(n), (t += 32));
    }
    t += 350;
    items.forEach((_, idx) => {
      at(() => setShown(idx + 1), t);
      t += 480;
      at(() => setResolved(idx + 1), t);
      t += 140;
    });
    at(() => setDone(true), t);
    at(() => {
      setTyped(0);
      setShown(0);
      setResolved(0);
      setDone(false);
      setCycle((c) => c + 1);
    }, Math.max(t + 2400, 9000));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycle, reduced, cmd]);

  const static_ = reduced;
  const shownItems = static_ ? items : items.slice(0, shown);

  return (
    <div
      data-testid="hero-terminal"
      className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl bg-slate-950/80 shadow-2xl shadow-indigo-950/50 ring-1 ring-white/15 backdrop-blur-md"
    >
      <Chrome />
      <div className="p-4 font-mono text-[11px] leading-relaxed">
        <div className="flex items-center">
          <span className="mr-2 text-emerald-400">$</span>
          <span className="text-slate-200">{static_ ? cmd : cmd.slice(0, typed)}</span>
          {!static_ && <span className="pulse-dot ml-0.5 text-indigo-300">▌</span>}
        </div>
        {shownItems.map((it, idx) => (
          <ItemLine key={it.slug} it={it} done={static_ || idx < resolved} />
        ))}
        {(static_ || done) && (
          <>
            <div className="mt-2.5 text-emerald-300">{items.length} items installed in 2.1s</div>
            <div className="mt-1.5 flex items-center">
              <span className="mr-2 text-emerald-400">$</span>
              <span className="pulse-dot text-indigo-300">▌</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
