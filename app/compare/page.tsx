import { PageHeader } from "@/components/page-header";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, ShieldAlert, Users } from "lucide-react";
import { getDb } from "@/lib/db";
import { RiskBadge, StatusBadge, TypeBadge, VersionChip } from "@/components/badges";
import { StarRow } from "@/components/stars";
import { PERMISSIONS } from "@/lib/utils";

interface Row {
  id: number; slug: string; name: string; type: string; summary: string;
  current_version: string; risk_level: string; risk_score: number; status: string;
  downloads: number; permissions: string; install_command: string; author_name: string;
  rating_avg: number; rating_count: number; tags: string[]; teams: string[];
}

function Row_({ label, children }: { label: string; children: React.ReactNode }) {
  return children;
}

export default async function ComparePage({ searchParams }: { params: Promise<never>; searchParams: Promise<{ ids?: string }> }) {
  const { ids } = await searchParams;
  const list = (ids ?? "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 3);
  if (list.length < 2) {
    return (
      <div className="mx-auto max-w-xl py-20 text-center">
        <PageHeader eyebrow="Catalog" title="Compare plugins" />
        <p className="mt-2 text-sm text-slate-500">Pick 2–3 plugins with the scale button on any card, then hit Compare.</p>
        <Link href="/" className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"><ArrowLeft className="h-4 w-4" /> Browse catalog</Link>
      </div>
    );
  }
  const ph = list.map(() => "?").join(",");
  const db = getDb();
  const rows = db.prepare(
    `SELECT p.*, COALESCE(u.name,'unknown') AS author_name,
            COALESCE((SELECT AVG(rating) FROM reviews r WHERE r.plugin_id=p.id),0) AS rating_avg,
            (SELECT COUNT(*) FROM reviews r WHERE r.plugin_id=p.id) AS rating_count
     FROM plugins p LEFT JOIN users u ON u.id=p.author_id WHERE p.status = 'approved' AND p.id IN (${ph})`
  ).all(...list) as unknown as Row[];
  if (rows.length < 2) notFound();
  for (const r of rows) {
    r.tags = (db.prepare(`SELECT tag FROM plugin_tags WHERE plugin_id=?`).all(r.id) as { tag: string }[]).map((t) => t.tag);
    r.teams = (db.prepare(`SELECT t.name FROM team_usage tu JOIN teams t ON t.id=tu.team_id WHERE tu.plugin_id=?`).all(r.id) as { name: string }[]).map((t) => t.name);
  }
  const items = list.map((id) => rows.find((r) => r.id === id)).filter(Boolean) as Row[];
  if (items.length < 2) notFound();

  const perm = (r: Row) => { try { return JSON.parse(r.permissions) as string[]; } catch { return []; } };
  const spec: { label: string; cell: (r: Row) => React.ReactNode }[] = [
    { label: "Type", cell: (r) => <TypeBadge type={r.type} /> },
    { label: "Version", cell: (r) => <VersionChip version={r.current_version} /> },
    { label: "Rating", cell: (r) => <StarRow avg={r.rating_avg} count={r.rating_count} /> },
    { label: "Risk", cell: (r) => <RiskBadge level={r.risk_level} score={r.risk_score} /> },
    { label: "Installs", cell: (r) => <span className="inline-flex items-center gap-1 text-sm"><Download className="h-3.5 w-3.5 text-slate-400" />{r.downloads.toLocaleString()}</span> },
    { label: "Teams using", cell: (r) => r.teams.length ? <span className="inline-flex items-center gap-1 text-sm"><Users className="h-3.5 w-3.5 text-slate-400" />{r.teams.join(", ")}</span> : <span className="text-slate-400">—</span> },
    { label: "Permissions", cell: (r) => perm(r).length ? <ul className="space-y-0.5">{perm(r).map((x) => <li key={x} className="text-xs text-slate-600">{PERMISSIONS.find((y) => y.id === x)?.label ?? x}</li>)}</ul> : <span className="text-xs text-slate-400">none declared</span> },
    { label: "Tags", cell: (r) => <span className="flex flex-wrap gap-1">{r.tags.map((t) => <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{t}</span>)}</span> },
    { label: "Install", cell: (r) => <code className="block truncate rounded bg-slate-900 px-2 py-1 font-mono text-[11px] text-slate-100">{r.install_command}</code> },
  ];

  return (
    <div className="space-y-6">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" /> Back to catalog</Link>
      <PageHeader eyebrow="Catalog" title={`Compare ${items.length} plugins`} />
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[640px] text-left">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="w-40 px-5 py-4" />
              {items.map((r) => (
                <th key={r.id} className="px-5 py-4 align-top">
                  <Link href={`/plugins/${r.slug}`} className="font-semibold text-slate-900 hover:text-indigo-700">{r.name}</Link>
                  <p className="mt-1 line-clamp-2 text-xs font-normal text-slate-500">{r.summary}</p>
                  <p className="mt-1 text-xs font-normal text-slate-400">by {r.author_name} · <StatusBadge status={r.status} /></p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {spec.map((row) => (
              <tr key={row.label}>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{row.label}</th>
                {items.map((r) => <td key={r.id} className="px-5 py-3 align-top">{row.cell(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-slate-400"><ShieldAlert className="h-3.5 w-3.5" /> Risk scores come from the submission security scan and declared permissions.</p>
    </div>
  );
}
