import Link from "next/link";
import { Download, Users } from "lucide-react";
import { RiskBadge, TypeBadge, TypeIcon, VersionChip, VerifiedMark } from "./badges";
import { AddToTrayButton } from "./tray";
import { CompareButton } from "./compare";
import { FavButton } from "./favorites";
import { StarRow } from "./stars";
import { fmtDate } from "@/lib/utils";
import type { PluginListItem } from "@/lib/queries";

const ACCENTS: Record<string, string> = {
  skill: "linear-gradient(90deg,#8b5cf6,#c4b5fd)",
  mcp: "linear-gradient(90deg,#0ea5e9,#7dd3fc)",
  plugin: "linear-gradient(90deg,#10b981,#6ee7b7)",
  documentation: "linear-gradient(90deg,#d97706,#fcd34d)",
};

const TYPE_ICON_BG: Record<string, string> = {
  skill: "bg-violet-100 text-violet-600",
  mcp: "bg-sky-100 text-sky-600",
  plugin: "bg-emerald-100 text-emerald-600",
  documentation: "bg-amber-100 text-amber-600",
};

const TYPE_SHADOW: Record<string, string> = {
  skill: "hover:shadow-violet-200/70",
  mcp: "hover:shadow-sky-200/70",
  plugin: "hover:shadow-emerald-200/70",
  documentation: "hover:shadow-amber-200/70",
};

export function PluginCard({ p, i = 0 }: { p: PluginListItem; i?: number }) {
  return (
    <article
      aria-label={p.name}
      style={{ ["--accent" as string]: ACCENTS[p.type], ["--i" as string]: i }}
      title={`${p.name} · updated ${fmtDate(p.updated_at)}`}
      className={`card-accent spotlight enter group relative flex flex-col rounded-2xl bg-white p-4 pt-5 ring-1 ring-slate-200 transition duration-200 hover:-translate-y-1 hover:shadow-xl ${TYPE_SHADOW[p.type] ?? "hover:shadow-slate-200/70"}`}
    >
      <span className="card-actions relative z-10 flex items-center justify-end gap-1.5">
        <FavButton id={p.id} name={p.name} />
        <CompareButton item={{ id: p.id, slug: p.slug, name: p.name }} />
        <AddToTrayButton item={{ id: p.id, slug: p.slug, name: p.name, type: p.type }} />
      </span>
      <div className="flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition duration-200 group-hover:scale-110 ${TYPE_ICON_BG[p.type] ?? "bg-slate-100 text-slate-500"}`}>
          <TypeIcon type={p.type} className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0">
          <div className="flex items-start gap-1">
            <Link
              href={`/plugins/${p.slug}`}
              className="line-clamp-2 leading-snug font-semibold text-slate-900 outline-none group-hover:text-indigo-700 after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-indigo-400"
            >
              {p.name}
            </Link>
            {p.verified_at && <VerifiedMark className="relative z-10 mt-0.5" />}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <VersionChip version={p.current_version} />
            <TypeBadge type={p.type} />
            <RiskBadge level={p.risk_level} />
          </div>
        </div>
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
      <div className="mt-4 flex items-center whitespace-nowrap border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span className="flex items-center gap-3">
          <StarRow avg={p.rating_avg} count={p.rating_count} />
          <span className="inline-flex items-center gap-1" title="Installs">
            <Download className="h-3.5 w-3.5" /> {p.downloads}
          </span>
          {p.teams.length > 0 && (
            <span className="inline-flex items-center gap-1" title={`Used by: ${p.teams.map((t) => t.name).join(", ")}`}>
              <Users className="h-3.5 w-3.5" /> {p.teams.length} team{p.teams.length === 1 ? "" : "s"}
            </span>
          )}
        </span>
      </div>
    </article>
  );
}
