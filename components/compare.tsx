"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { GitCompareArrows, Scale, X } from "lucide-react";

interface CompareItem { id: number; slug: string; name: string }
interface Ctx { items: CompareItem[]; toggle: (i: CompareItem) => void; remove: (id: number) => void; clear: () => void; has: (id: number) => boolean }
const CompareCtx = createContext<Ctx | null>(null);
const MAX = 3;

export function CompareProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CompareItem[]>([]);
  const value: Ctx = {
    items,
    has: (id) => items.some((i) => i.id === id),
    toggle: (i) => setItems((c) => (c.some((x) => x.id === i.id) ? c.filter((x) => x.id !== i.id) : c.length >= MAX ? c : [...c, i])),
    remove: (id) => setItems((c) => c.filter((x) => x.id !== id)),
    clear: () => setItems([]),
  };
  return <CompareCtx.Provider value={value}>{children}</CompareCtx.Provider>;
}

export function useCompare() {
  const c = useContext(CompareCtx);
  if (!c) throw new Error("useCompare must be inside CompareProvider");
  return c;
}

export function CompareButton({ item }: { item: CompareItem }) {
  const { toggle, has } = useCompare();
  const active = has(item.id);
  return (
    <button
      type="button"
      aria-label={`${active ? "Remove" : "Add"} ${item.name} ${active ? "from" : "to"} comparison`}
      title={active ? "Remove from comparison" : "Compare"}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(item); }}
      className={`inline-flex items-center rounded-lg border p-1.5 transition ${active ? "border-indigo-400 bg-indigo-50 text-indigo-600" : "border-slate-200 bg-white text-slate-400 hover:border-indigo-300 hover:text-indigo-600"}`}
    >
      <Scale className="h-3.5 w-3.5" />
    </button>
  );
}

export function CompareBar() {
  const { items, remove, clear } = useCompare();
  const router = useRouter();
  if (items.length === 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-slate-200 bg-white py-2 pl-4 pr-2 shadow-xl">
      <Scale className="h-4 w-4 text-indigo-600" />
      {items.map((i) => (
        <span key={i.id} className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
          {i.name}
          <button onClick={() => remove(i.id)} aria-label={`Remove ${i.name}`}><X className="h-3 w-3" /></button>
        </span>
      ))}
      <button
        disabled={items.length < 2}
        onClick={() => { router.push(`/compare?ids=${items.map((i) => i.id).join(",")}`); clear(); }}
        className="ml-1 inline-flex items-center gap-1 rounded-full bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
      >
        <GitCompareArrows className="h-3.5 w-3.5" /> Compare
      </button>
    </div>
  );
}
