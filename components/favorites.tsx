"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Heart, PackageSearch } from "lucide-react";
import { TypeBadge } from "./badges";
import { StarRow } from "./stars";

interface FavCtx { ids: number[]; toggle: (id: number) => void; has: (id: number) => boolean }
const Ctx = createContext<FavCtx | null>(null);
const KEY = "agenthub:favorites";

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<number[]>([]);
  useEffect(() => { try { const r = localStorage.getItem(KEY); if (r) setIds(JSON.parse(r)); } catch { /* noop */ } }, []);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* noop */ } }, [ids]);
  return <Ctx.Provider value={{ ids, has: (id) => ids.includes(id), toggle: (id) => setIds((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id])) }}>{children}</Ctx.Provider>;
}

export function useFavorites() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useFavorites must be inside FavoritesProvider");
  return c;
}

export function FavButton({ id, name, withLabel = false }: { id: number; name: string; withLabel?: boolean }) {
  const { toggle, has } = useFavorites();
  const active = has(id);
  return (
    <button
      type="button"
      aria-label={`${active ? "Remove" : "Add"} ${name} ${active ? "from" : "to"} favorites`}
      title={active ? "Saved to favorites" : "Save to favorites"}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(id); }}
      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 transition ${active ? "border-rose-300 bg-rose-50 text-rose-500" : "border-slate-200 bg-white text-slate-400 hover:border-rose-300 hover:text-rose-500"}`}
    >
      <Heart className={`h-3.5 w-3.5 ${active ? "fill-rose-500" : ""}`} />
      {withLabel && <span className="text-sm font-medium">{active ? "Saved" : "Save"}</span>}
    </button>
  );
}

export function FavoritesList({ items }: { items: { id: number; slug: string; name: string; type: string; summary: string; rating_avg: number; rating_count: number }[] }) {
  const { ids, has, toggle } = useFavorites();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return <p className="py-16 text-center text-sm text-slate-400">Loading favorites…</p>;
  const favs = items.filter((i) => ids.includes(i.id));
  if (favs.length === 0)
    return (
      <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
        <PackageSearch className="h-10 w-10 text-slate-300" />
        <p className="mt-3 font-medium text-slate-700">No favorites yet</p>
        <p className="mt-1 text-sm text-slate-500">Tap the heart on any catalog item to save it here.</p>
        <Link href="/" className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Browse catalog</Link>
      </div>
    );
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {favs.map((p) => (
        <div key={p.id} className="relative rounded-xl border border-slate-200 bg-white p-4 transition hover:border-rose-200 hover:shadow-md">
          <Link href={`/plugins/${p.slug}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="font-semibold text-slate-900">{p.name}</div>
              <TypeBadge type={p.type} />
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-slate-600">{p.summary}</p>
            <div className="mt-3"><StarRow avg={p.rating_avg} count={p.rating_count} /></div>
          </Link>
          <button
            onClick={() => toggle(p.id)}
            aria-label={`Remove ${p.name} from favorites`}
            className="absolute right-3 top-3 mt-8 text-slate-300 hover:text-rose-500"
          >
            <Heart className={`h-4 w-4 ${has(p.id) ? "fill-rose-500 text-rose-500" : ""}`} />
          </button>
        </div>
      ))}
    </div>
  );
}
