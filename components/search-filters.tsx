"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

const TYPES = [
  { id: "all", label: "All types" },
  { id: "skill", label: "Skills" },
  { id: "mcp", label: "MCP Servers" },
  { id: "plugin", label: "Plugins" },
  { id: "documentation", label: "Docs" },
];

export function SearchFilters({
  tags,
  teams,
  counts,
}: {
  tags: { tag: string; count: number }[];
  teams: { id: number; name: string }[];
  counts: { total: number; filtered: number };
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const type = params.get("type") ?? "all";
  const tag = params.get("tag") ?? "";
  const team = params.get("team") ?? "";
  const sort = params.get("sort") ?? "recent";

  function push(next: Record<string, string>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v && v !== "all") sp.set(k, v);
      else sp.delete(k);
    }
    router.replace(`/?${sp.toString()}`, { scroll: false });
  }

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      const cur = params.get("q") ?? "";
      if (q !== cur) push({ q });
    }, 300);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs font-medium transition ${
      active
        ? "border-indigo-600 bg-indigo-600 text-white"
        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
    }`;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search skills, MCP servers, plugins, docs…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={team}
            onChange={(e) => push({ team: e.target.value })}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm"
          >
            <option value="">Any team usage</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                Used by {t.name}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => push({ sort: e.target.value })}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm"
          >
            <option value="recent">Recently updated</option>
            <option value="name">Name A–Z</option>
            <option value="downloads">Most downloaded</option>
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {TYPES.map((t) => (
          <button key={t.id} onClick={() => push({ type: t.id })} className={chip(type === t.id)}>
            {t.label}
          </button>
        ))}
        <span className="mx-1 hidden h-4 w-px bg-slate-300 sm:block" />
        <button onClick={() => push({ tag: "" })} className={chip(!tag)}>
          All tags
        </button>
        {tags.slice(0, 10).map((t) => (
          <button key={t.tag} onClick={() => push({ tag: tag === t.tag ? "" : t.tag })} className={chip(tag === t.tag)}>
            {t.tag} <span className="opacity-60">{t.count}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        {counts.filtered} of {counts.total} item{counts.total === 1 ? "" : "s"}
      </p>
    </div>
  );
}
