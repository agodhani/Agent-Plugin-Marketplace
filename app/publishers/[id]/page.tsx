import { PageHeader } from "@/components/page-header";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Package, Star } from "lucide-react";
import { getDb } from "@/lib/db";
import { listPlugins, countPlugins, publisherStats, PAGE_SIZE } from "@/lib/queries";
import { Pagination } from "@/components/pagination";
import { PluginCard } from "@/components/plugin-card";
import { fmtDate } from "@/lib/utils";

export default async function PublisherPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const db = getDb();
  const author = db.prepare(`SELECT id, name, email, created_at, is_admin FROM users WHERE id = ?`).get(Number(id)) as
    | { id: number; name: string; email: string; created_at: string; is_admin: number }
    | undefined;
  if (!author) notFound();
  const sp = await searchParams;
  const totalItems = countPlugins({ authorId: author.id });
  const stats = publisherStats(author.id);
  const lastPage = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const rp = Number(sp.page);
  const page = Number.isInteger(rp) && rp >= 1 ? Math.min(rp, lastPage) : 1;
  const items = listPlugins({ authorId: author.id, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  const playbooks = db.prepare(`SELECT slug, name, description FROM playbooks WHERE author_id = ? ORDER BY name`).all(author.id) as { slug: string; name: string; description: string }[];
  const installs = stats.downloads;
  const avg = stats.avg ?? 0;

  return (
    <div className="space-y-6">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Back to catalog
      </Link>
      <div className="flex flex-wrap items-center gap-5 rounded-2xl border border-slate-200 bg-white p-6">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 text-2xl font-bold text-indigo-700">
          {author.name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <PageHeader
            eyebrow="Publisher"
            title={author.name}
            subtitle={`Publishing since ${fmtDate(author.created_at)}${author.is_admin ? " · Marketplace admin" : ""}`}
          />
        </div>
        <div className="flex gap-6 text-center">
          <div><p className="text-xl font-bold text-slate-900">{stats.count}</p><p className="flex items-center gap-1 text-xs text-slate-500"><Package className="h-3 w-3" /> plugins</p></div>
          <div><p className="text-xl font-bold text-slate-900">{installs.toLocaleString()}</p><p className="flex items-center gap-1 text-xs text-slate-500"><Download className="h-3 w-3" /> installs</p></div>
          <div><p className="text-xl font-bold text-slate-900">{avg ? avg.toFixed(1) : "—"}</p><p className="flex items-center gap-1 text-xs text-slate-500"><Star className="h-3 w-3" /> avg rating</p></div>
        </div>
      </div>

      <section>
        <h2 className="mb-3 font-semibold text-slate-900">Plugins</h2>
        {items.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">Nothing published yet.</p>
        ) : (
          <div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((p) => <PluginCard key={p.id} p={p} />)}</div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={totalItems} params={{}} />
          </div>
        )}
      </section>

      {playbooks.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold text-slate-900">Playbooks</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {playbooks.map((pb) => (
              <Link key={pb.slug} href={`/playbooks/${pb.slug}`} className="rounded-xl border border-fuchsia-200 bg-fuchsia-50/60 p-4 transition hover:border-fuchsia-400 hover:shadow-md">
                <div className="font-semibold text-slate-900">{pb.name}</div>
                <p className="mt-1 line-clamp-2 text-sm text-slate-600">{pb.description}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
