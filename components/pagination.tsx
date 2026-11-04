import Link from "next/link";

export function Pagination({ page, pageSize, total, params }: { page: number; pageSize: number; total: number; params: Record<string, string | undefined> }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const href = (n: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    if (n > 1) sp.set("page", String(n)); else sp.delete("page");
    const s = sp.toString();
    return `?${s}`;
  };
  const btn = "inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-indigo-300 hover:text-indigo-700";
  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-between">
      <p className="text-sm text-slate-500">Showing {from}–{to} of {total}</p>
      <div className="flex items-center gap-2">
        {page > 1 && <Link href={href(page - 1)} className={btn}>← Previous</Link>}
        {page < pages && <Link href={href(page + 1)} className={btn}>Next →</Link>}
      </div>
    </nav>
  );
}
