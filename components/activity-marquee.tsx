import Link from "next/link";
import { Activity } from "lucide-react";
import { recentActivity, type ActivityItem } from "@/lib/queries";
import { timeAgo } from "@/lib/utils";

const INCLUDED = new Set([
  "submission_approved",
  "version_published",
  "downloaded",
  "review_posted",
  "playbook_created",
  "team_usage_added",
]);

const PLUGIN_BOUND = new Set(["submission_approved", "version_published", "downloaded", "review_posted", "team_usage_added"]);

interface Seg { t: string; b?: boolean }

function details(a: ActivityItem): Record<string, unknown> {
  try { return JSON.parse(a.details || "{}"); } catch { return {}; }
}

function segs(a: ActivityItem): Seg[] | null {
  if (!INCLUDED.has(a.action)) return null;
  if (PLUGIN_BOUND.has(a.action) && a.plugin_status !== "approved") return null;
  const d = details(a);
  const actor = { t: a.actor_name, b: true } as Seg;
  const plugin = { t: a.entity_name, b: true } as Seg;
  switch (a.action) {
    case "team_usage_added":
      return typeof d.team === "string"
        ? [actor, { t: " added " }, plugin, { t: " to " }, { t: `${d.team as string}'s`, b: true }, { t: " stack" }]
        : null;
    case "downloaded":
      return [actor, { t: " installed " }, plugin];
    case "review_posted":
      return typeof d.rating === "number"
        ? [actor, { t: " rated " }, plugin, { t: ` ★${d.rating}` }]
        : [actor, { t: " reviewed " }, plugin];
    case "submission_approved":
    case "version_published":
      return typeof d.version === "string"
        ? [plugin, { t: ` v${d.version} was published` }]
        : [plugin, { t: " was published" }];
    case "playbook_created":
      return [actor, { t: " created the playbook " }, { t: a.entity_name, b: true }];
    default:
      return null;
  }
}

export function ActivityMarquee() {
  const perAction = new Map<string, { a: ActivityItem; s: Seg[] }[]>();
  for (const a of recentActivity(120)) {
    const s = segs(a);
    if (!s) continue;
    const list = perAction.get(a.action) ?? [];
    if (list.length < 4) list.push({ a, s });
    perAction.set(a.action, list);
  }
  // interleave action types for variety
  const buckets = [...perAction.values()].filter((b) => b.length > 0);
  const items: { key: string; href: string | null; s: Seg[]; ago: string }[] = [];
  for (let i = 0; items.length < 16 && buckets.some((b) => b.length); i++) {
    const b = buckets[i % buckets.length];
    const it = b.shift();
    if (it) {
      items.push({
        key: String(it.a.id),
        href: it.a.plugin_slug ? `/plugins/${it.a.plugin_slug}` : it.a.playbook_slug ? `/playbooks/${it.a.playbook_slug}` : null,
        s: it.s,
        ago: timeAgo(it.a.created_at),
      });
    }
  }
  if (items.length === 0) return null;

  const track = (dup: boolean) => (
    <ul aria-hidden={dup || undefined} className="flex shrink-0 items-center gap-2.5 pr-2.5">
      <li className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        <Activity className="h-3.5 w-3.5 text-indigo-400" /> Live
      </li>
      {items.map((it) => (
        <li key={`${it.key}-${dup ? "b" : "a"}`}>
          {it.href ? (
            <Link href={it.href} tabIndex={dup ? -1 : undefined}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs text-slate-600 shadow-sm transition duration-200 hover:border-indigo-300 hover:text-indigo-700">
              {it.s.map((g, j) => <span key={j} className={g.b ? "font-medium text-slate-800" : undefined}>{g.t}</span>)}
              <span className="text-slate-400">· {it.ago}</span>
            </Link>
          ) : (
            <span className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs text-slate-600 shadow-sm">
              {it.s.map((g, j) => <span key={j} className={g.b ? "font-medium text-slate-800" : undefined}>{g.t}</span>)}
              <span className="text-slate-400">· {it.ago}</span>
            </span>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <section aria-label="Live marketplace activity" className="marquee relative">
      <div className="marquee-track flex w-max items-center">
        {track(false)}
        {track(true)}
      </div>
    </section>
  );
}
