import Link from "next/link";
import { Download, Users } from "lucide-react";
import { RiskBadge, TypeBadge, TypeIcon, VersionChip } from "./badges";
import { AddToTrayButton } from "./tray";
import { StarRow } from "./stars";
import { fmtDate } from "@/lib/utils";
import type { PluginListItem } from "@/lib/queries";

const TYPE_ICON_BG: Record<string, string> = {
  skill: "bg-violet-100 text-violet-600",
  mcp: "bg-sky-100 text-sky-600",
  plugin: "bg-emerald-100 text-emerald-600",
  documentation: "bg-amber-100 text-amber-600",
};

export function PluginCard({ p }: { p: PluginListItem }) {
  return (
    <Link
      href={`/plugins/${p.slug}`}
      className="group flex flex-col rounded-xl border border-slate-200 bg-white p-4 transition hover:border-indigo-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TYPE_ICON_BG[p.type] ?? "bg-slate-100 text-slate-500"}`}>
            <TypeIcon type={p.type} className="h-4.5 w-4.5" />
          </span>
          <div>
            <div className="font-semibold text-slate-900 group-hover:text-indigo-700">{p.name}</div>
            <div className="mt-0.5 flex items-center gap-1.5">
              <VersionChip version={p.current_version} />
              <TypeBadge type={p.type} />
            </div>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-1.5">
          <RiskBadge level={p.risk_level} />
          <AddToTrayButton item={{ id: p.id, slug: p.slug, name: p.name, type: p.type }} />
        </span>
      </div>
      <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-relaxed text-slate-600">{p.summary}</p>
      {p.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {p.tags.slice(0, 4).map((t) => (
            <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              {t}
            </span>
          ))}
          {p.tags.length > 4 && <span className="text-[11px] text-slate-400">+{p.tags.length - 4}</span>}
        </div>
      )}
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span className="flex items-center gap-3">
          <StarRow avg={p.rating_avg} count={p.rating_count} />
          <span className="inline-flex items-center gap-1" title="Downloads">
            <Download className="h-3.5 w-3.5" /> {p.downloads}
          </span>
          {p.teams.length > 0 && (
            <span className="inline-flex items-center gap-1" title={`Used by: ${p.teams.map((t) => t.name).join(", ")}`}>
              <Users className="h-3.5 w-3.5" /> {p.teams.length} team{p.teams.length === 1 ? "" : "s"}
            </span>
          )}
        </span>
        <span>updated {fmtDate(p.updated_at)}</span>
      </div>
    </Link>
  );
}
