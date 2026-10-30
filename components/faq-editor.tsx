"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

export function FaqEditor() {
  const [rows, setRows] = useState<{ q: string; a: string }[]>([]);
  const update = (i: number, key: "q" | "a", v: string) =>
    setRows((r) => r.map((row, j) => (j === i ? { ...row, [key]: v } : row)));
  return (
    <div className="space-y-3">
      <input type="hidden" name="faq" value={JSON.stringify(rows.filter((r) => r.q.trim() && r.a.trim()))} />
      {rows.map((row, i) => (
        <div key={i} className="relative rounded-lg border border-slate-200 bg-slate-50 p-3">
          <button
            type="button"
            onClick={() => setRows((r) => r.filter((_, j) => j !== i))}
            className="absolute right-2 top-2 text-slate-400 hover:text-slate-700"
            aria-label="Remove"
          >
            <X className="h-4 w-4" />
          </button>
          <input
            value={row.q}
            onChange={(e) => update(i, "q", e.target.value)}
            placeholder="Question"
            className="mb-2 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 pr-8 text-sm"
          />
          <textarea
            value={row.a}
            onChange={(e) => update(i, "a", e.target.value)}
            placeholder="Answer"
            rows={2}
            className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows((r) => [...r, { q: "", a: "" }])}
        className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:border-indigo-400 hover:text-indigo-600"
      >
        <Plus className="h-3.5 w-3.5" /> Add FAQ
      </button>
    </div>
  );
}
