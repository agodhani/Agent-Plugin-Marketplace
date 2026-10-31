import { PageHeader } from "@/components/page-header";
import Link from "next/link";
import { Users } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { listTeams, teamPlugins } from "@/lib/queries";
import { JoinLeaveButton } from "@/components/team-buttons";
import { CreateTeamForm } from "@/components/create-team-form";
import { TypeBadge } from "@/components/badges";

export default async function TeamsPage() {
  const user = await getCurrentUser();
  const teams = listTeams(user?.id);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Workspace"
        title="Teams"
        subtitle="Teams mark which plugins they rely on — it helps others discover what's battle-tested and gives admins an ownership trail."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {teams.map((t) => {
            const used = teamPlugins(t.id);
            return (
              <div key={t.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="flex items-center gap-2 font-semibold text-slate-900">
                      <Users className="h-4 w-4 text-slate-400" /> {t.name}
                      {t.is_member ? <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">MEMBER</span> : null}
                    </h2>
                    {t.description && <p className="mt-1 text-sm text-slate-500">{t.description}</p>}
                    <p className="mt-2 text-xs text-slate-400">
                      {t.member_count} member{t.member_count === 1 ? "" : "s"}
                      {t.member_names && ` — ${t.member_names}`}
                    </p>
                  </div>
                  <JoinLeaveButton teamId={t.id} isMember={!!t.is_member} loggedIn={!!user} />
                </div>
                {used.length > 0 && (
                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Uses {used.length} plugin{used.length === 1 ? "" : "s"}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {used.map((p) => (
                        <Link
                          key={p.id}
                          href={`/plugins/${p.slug}`}
                          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-indigo-300 hover:text-indigo-700"
                        >
                          {p.name}
                          <TypeBadge type={p.type} />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {teams.length === 0 && (
            <p className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
              No teams yet — create the first one.
            </p>
          )}
        </div>
        <div>{user ? <CreateTeamForm /> : <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500"><Link href="/login" className="font-medium text-indigo-600 hover:underline">Log in</Link> to create or join teams.</p>}</div>
      </div>
    </div>
  );
}
