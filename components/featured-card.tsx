import Link from "next/link";
import { Download, Flame } from "lucide-react";
import { RiskBadge, TypeBadge, TypeIcon, VersionChip } from "./badges";
import { StarRow } from "./stars";
import type { PluginListItem } from "@/lib/queries";

const TYPE_ICON_BG: Record<string, string> = {
  skill: "bg-violet-100 text-violet-600",
  mcp: "bg-sky-100 text-sky-600",
  plugin: "bg-emerald-100 text-emerald-600",
  documentation: "bg-amber-100 text-amber-600",
};

export function FeaturedCard({ p }: { p: PluginListItem }) {
  return (
    <Link
      href={`/plugins/${p.slug}`}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white transition hover:shadow-xl"
    >
      <div>
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-300">
            <Flame className="h-3.5 w-3.5" /> Staff pick
          </span>
          <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${TYPE_ICON_BG[p.type] ?? "bg-slate-700 text-slate-300"}`}>
            <TypeIcon type={p.type} className="h-5 w-5" />
          </span>
        </div>
        <h3 className="mt-4 text-xl font-bold group-hover:text-indigo-300">{p.name}</h3>
        <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-slate-300">{p.summary}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <TypeBadge type={p.type} />
          <VersionChip version={p.current_version} />
          <RiskBadge level={p.risk_level} />
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-sm text-slate-300">
        <StarRow avg={p.rating_avg} count={p.rating_count} />
        <span className="inline-flex items-center gap-1.5">
          <Download className="h-4 w-4" /> {p.downloads.toLocaleString()} installs
        </span>
      </div>
    </Link>
  );
}
