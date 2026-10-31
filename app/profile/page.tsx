import { PageHeader } from "@/components/page-header";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { mySubmissions, myTeams } from "@/lib/queries";
import { RiskBadge, StatusBadge } from "@/components/badges";
import { AdminToggle } from "@/components/admin-toggle";
import { fmtDateTime } from "@/lib/utils";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const teams = myTeams(user.id);
  const subs = mySubmissions(user.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader eyebrow="Account" title="Profile" />

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-lg font-semibold text-indigo-700">
            {user.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <p className="font-semibold text-slate-900">{user.name}</p>
            <p className="text-sm text-slate-500">{user.email}</p>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-amber-900">Admin access {user.is_admin ? "enabled" : "disabled"}</p>
              <p className="text-xs text-amber-700">Testing toggle — grants the review console. In production this requires approval.</p>
            </div>
          </div>
          <AdminToggle isAdmin={!!user.is_admin} />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="mb-3 font-semibold text-slate-900">My teams</h2>
        {teams.length ? (
          <div className="flex flex-wrap gap-2">
            {teams.map((t) => (
              <span key={t.id} className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700">{t.name}</span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Not in any team — <Link href="/teams" className="text-indigo-600 hover:underline">browse teams</Link>.</p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="mb-3 font-semibold text-slate-900">My submissions</h2>
        {subs.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing submitted yet — <Link href="/submit" className="text-indigo-600 hover:underline">submit a plugin</Link>.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {subs.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <Link href={`/submissions/${s.id}`} className="font-medium text-slate-800 hover:text-indigo-700">
                    {s.plugin_name} <span className="font-mono text-xs text-slate-400">v{s.version}</span>
                  </Link>
                  <p className="text-xs text-slate-400">
                    {s.kind === "new" ? "New entry" : "Version update"} · {fmtDateTime(s.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <RiskBadge level={s.risk_level} />
                  <StatusBadge status={s.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
