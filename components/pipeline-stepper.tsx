import { Check, FileSearch, ListChecks, ShieldCheck, Upload, X } from "lucide-react";

const STEPS = [
  { id: "upload", label: "Upload", desc: "Bundle & manifest", icon: Upload },
  { id: "validation", label: "Validation scan", desc: "Manifest & file checks", icon: FileSearch },
  { id: "security", label: "Security scan", desc: "Static analysis findings", icon: ShieldCheck },
  { id: "risk", label: "Risk score", desc: "Permissions & findings", icon: ListChecks },
  { id: "review", label: "Admin review", desc: "Final approval gate", icon: Check },
];

export function PipelineStepper({ status }: { status?: "pending" | "approved" | "rejected" }) {
  return (
    <ol className="grid grid-cols-1 gap-3 sm:grid-cols-5" aria-label="Governance pipeline">
      {STEPS.map((s, i) => {
        const isReview = i === STEPS.length - 1;
        const approved = status === "approved";
        const done = approved || (status !== undefined && !isReview);
        const rejected = status === "rejected" && isReview;
        const current = status === "pending" && isReview;
        const Icon = rejected ? X : done ? Check : s.icon;
        const cls = rejected
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : done
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : current
              ? "border-indigo-300 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-100"
              : "border-slate-200 bg-white text-slate-500";
        return (
          <li
            key={s.id}
            aria-current={current ? "step" : undefined}
            className={`flex items-start gap-2.5 rounded-xl border p-3 transition ${cls}`}
          >
            <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
              rejected ? "bg-rose-100" : done ? "bg-emerald-100" : current ? "bg-indigo-100" : "bg-slate-100"
            }`}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-semibold">{s.label}</span>
              <span className={`block text-[11px] leading-snug ${status === undefined ? "text-slate-400" : done ? "text-emerald-600/80" : rejected ? "text-rose-600/80" : current ? "text-indigo-600/80" : "text-slate-400"}`}>{s.desc}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
