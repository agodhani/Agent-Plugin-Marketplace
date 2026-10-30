import Link from "next/link";
import { ArrowRight, ClipboardList } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { adminStats, listSubmissions, recentAudit } from "@/lib/queries";
import { RiskBadge, StatusBadge, TypeBadge } from "@/components/badges";
import { describeAudit } from "@/lib/audit";
import { fmtDateTime } from "@/lib/utils";

export default async function AdminPage() {
  await requireAdmin();
  const stats = adminStats();
  const pending = listSubmissions("pending");
  const decided = listSubmissions().filter((s) => s.status !== "pending").slice(0, 10);
  const audit = recentAudit(60);

  const cards = [
    { label: "Pending reviews", value: stats.pending, accent: stats.pending > 0 },
    { label: "Catalog items", value: stats.approved },
    { label: "Rejected submissions", value: stats.rejected },
    { label: "Users", value: stats.users },
    { label: "Teams", value: stats.teams },
    { label: "Total downloads", value: stats.downloads },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Review console</h1>
        <p className="mt-1 text-sm text-slate-500">Approve or reject catalog submissions. Every decision is audit-logged.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-xl border p-4 ${c.accent ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}>
            <p className={`text-2xl font-bold ${c.accent ? "text-amber-700" : "text-slate-900"}`}>{c.value}</p>
            <p className="mt-0.5 text-xs text-slate-500">{c.label}</p>
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
          <ClipboardList className="h-4 w-4 text-slate-400" /> Pending queue ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
            Queue is clear — nothing waiting for review.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Plugin</th>
                  <th className="px-4 py-2.5 font-medium">Kind</th>
                  <th className="px-4 py-2.5 font-medium">Risk</th>
                  <th className="px-4 py-2.5 font-medium">Submitted by</th>
                  <th className="px-4 py-2.5 font-medium">When</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pending.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{s.plugin_name} <span className="font-mono text-xs text-slate-400">v{s.version}</span></div>
                      <div className="mt-0.5"><TypeBadge type={s.plugin_type} /></div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{s.kind === "new" ? "New entry" : "Version"}</td>
                    <td className="px-4 py-3"><RiskBadge level={s.risk_level} score={s.risk_score} /></td>
                    <td className="px-4 py-3 text-slate-600">{s.submitter_name}</td>
                    <td className="px-4 py-3 text-slate-500">{fmtDateTime(s.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/submissions/${s.id}`} className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:underline">
                        Review <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-semibold text-slate-900">Recent decisions</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Plugin</th>
                <th className="px-4 py-2.5 font-medium">Decision</th>
                <th className="px-4 py-2.5 font-medium">Reviewer</th>
                <th className="px-4 py-2.5 font-medium">Notes</th>
                <th className="px-4 py-2.5 font-medium">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {decided.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3">
                    <Link href={`/submissions/${s.id}`} className="font-medium text-slate-800 hover:text-indigo-700">
                      {s.plugin_name} <span className="font-mono text-xs text-slate-400">v{s.version}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-3 text-slate-600">{s.reviewer_name ?? "—"}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-slate-500">{s.review_notes || "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{fmtDateTime(s.reviewed_at)}</td>
                </tr>
              ))}
              {decided.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No reviews yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-semibold text-slate-900">Audit log</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Actor</th>
                <th className="px-4 py-2.5 font-medium">Action</th>
                <th className="px-4 py-2.5 font-medium">Entity</th>
                <th className="px-4 py-2.5 font-medium">Details</th>
                <th className="px-4 py-2.5 font-medium">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {audit.map((a) => {
                let details: Record<string, unknown> = {};
                try { details = JSON.parse(a.details); } catch { /* ignore */ }
                const detailStr = Object.entries(details)
                  .filter(([, v]) => v !== null && v !== "")
                  .map(([k, v]) => `${k}: ${String(v)}`)
                  .join(" · ");
                return (
                  <tr key={a.id}>
                    <td className="px-4 py-2.5 font-medium text-slate-700">{a.actor_name}</td>
                    <td className="px-4 py-2.5 text-slate-600">{describeAudit(a.action)}</td>
                    <td className="px-4 py-2.5 text-slate-600">
                      <span className="text-slate-400">{a.entity_type}/</span>{a.entity_name}
                    </td>
                    <td className="max-w-xs truncate px-4 py-2.5 text-xs text-slate-500">{detailStr || "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{fmtDateTime(a.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
