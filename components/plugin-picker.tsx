"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { TypeBadge } from "./badges";

export interface PickerItem {
  id: number;
  name: string;
  type: string;
  summary: string;
  tags: string[];
}

export function PluginPicker({ plugins, initialSelected = [] }: { plugins: PickerItem[]; initialSelected?: number[] }) {
  const [selected, setSelected] = useState<Set<number>>(new Set(initialSelected));
  const [q, setQ] = useState("");

  const filtered = plugins.filter(
    (p) =>
      !q ||
      p.name.toLowerCase().includes(q.toLowerCase()) ||
      p.summary.toLowerCase().includes(q.toLowerCase()) ||
      p.tags.some((t) => t.includes(q.toLowerCase()))
  );

  const toggle = (id: number) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const sorted = [...filtered].sort((a, b) => Number(selected.has(b.id)) - Number(selected.has(a.id)) || a.name.localeCompare(b.name));

  return (
    <div>
      {/* hidden inputs carry the full selection even when items are filtered out */}
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="items" value={id} />
      ))}
      <div className="mb-3 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search the catalog…"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${selected.size ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"}`}>
          {selected.size} selected
        </span>
      </div>
      <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
        {sorted.map((p) => (
          <label
            key={p.id}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
              selected.has(p.id) ? "border-indigo-400 bg-indigo-50/60" : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <input
              type="checkbox"
              checked={selected.has(p.id)}
              onChange={() => toggle(p.id)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-slate-800">{p.name}</span>
                <TypeBadge type={p.type} />
              </div>
              <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{p.summary}</p>
            </div>
          </label>
        ))}
        {filtered.length === 0 && <p className="py-6 text-center text-sm text-slate-400">No catalog items match.</p>}
      </div>
    </div>
  );
}
