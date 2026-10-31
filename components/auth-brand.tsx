import { Boxes, ClipboardList, ScanSearch, ShieldCheck } from "lucide-react";
import { AuroraBackdrop } from "./aurora-backdrop";

const BULLETS = [
  { icon: ScanSearch, text: "Every item security-scanned" },
  { icon: ShieldCheck, text: "Admin-approved before publish" },
  { icon: ClipboardList, text: "Fully audit-logged" },
];

/** Compact brand header for mobile auth pages. */
export function AuthBrandCompact() {
  return (
    <div className="mb-6 flex items-center justify-center gap-2 md:hidden">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/40">
        <Boxes className="h-4 w-4" />
      </span>
      <span className="font-semibold text-slate-900">AgentHub</span>
    </div>
  );
}

/** Aurora brand panel — left side of the auth split screen at md+. */
export function AuthBrandPanel() {
  return (
    <div className="relative hidden overflow-hidden rounded-3xl bg-gradient-to-b from-indigo-950 via-slate-950 to-slate-950 p-10 shadow-2xl shadow-indigo-950/30 ring-1 ring-white/10 md:flex md:flex-col md:justify-center">
      <AuroraBackdrop />
      <div className="relative">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-indigo-200">
          <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
          AgentHub · internal
        </span>
        <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-white">
          <span className="block">One catalog.</span>
          <span className="shimmer-text block">Every agent.</span>
        </h1>
        <ul className="mt-8 space-y-3 text-sm text-indigo-200/90">
          {BULLETS.map((b) => (
            <li key={b.text} className="flex items-center gap-2.5">
              <b.icon className="h-4 w-4 text-indigo-300" /> {b.text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
