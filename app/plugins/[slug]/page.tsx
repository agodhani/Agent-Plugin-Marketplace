import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, GitBranch, History, ShieldAlert, Upload, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import {
  getPluginAudit,
  getPluginBySlug,
  getPluginVersions,
  latestSubmissionForPlugin,
  myTeams,
  pendingSubmissionsForPlugin,
} from "@/lib/queries";
import { RiskBadge, StatusBadge, TypeBadge, TypeIcon, VersionChip } from "@/components/badges";
import { CopyButton, ShareButton } from "@/components/copy-button";
import { Tabs } from "@/components/tabs";
import { Markdown } from "@/components/markdown";
import { FaqAccordion } from "@/components/faq-accordion";
import { TeamUsageToggle } from "@/components/team-usage-toggle";
import { describeAudit } from "@/lib/audit";
import { fmtDate, fmtDateTime, PERMISSIONS } from "@/lib/utils";

const TYPE_ICON_BG: Record<string, string> = {
  skill: "bg-violet-100 text-violet-600",
  mcp: "bg-sky-100 text-sky-600",
  plugin: "bg-emerald-100 text-emerald-600",
  documentation: "bg-amber-100 text-amber-600",
};

export default async function PluginPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [user, p] = await Promise.all([getCurrentUser(), Promise.resolve(getPluginBySlug(slug))]);
  if (!p) notFound();
  const isAuthor = !!user && user.id === p.author_id;
  const isAdmin = !!user?.is_admin;
  if (p.status !== "approved" && !isAuthor && !isAdmin) notFound();

  const versions = getPluginVersions(p.id);
  const activity = getPluginAudit(p.id);
  const latestSub = latestSubmissionForPlugin(p.id);
  const pendingSubs = pendingSubmissionsForPlugin(p.id);
  const userTeams = user ? myTeams(user.id) : [];
  const usageTeams = userTeams.map((t) => ({ ...t, used: p.teams.some((x) => x.id === t.id) }));

  return (
    <div className="space-y-6">
      {p.status !== "approved" && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            p.status === "pending"
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {p.status === "pending" ? (
            <>
              <strong>Pending review.</strong> This submission ran through validation and security scans and is waiting
              for an admin. Only you and admins can see this page.{" "}
            </>
          ) : (
            <>
              <strong>Rejected.</strong> An admin rejected this submission — see the review notes on the{" "}
            </>
          )}
          {latestSub && (
            <Link href={`/submissions/${latestSub.id}`} className="font-medium underline">
              scan report
            </Link>
          )}
          .
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${
                TYPE_ICON_BG[p.type] ?? "bg-slate-100 text-slate-500"
              }`}
            >
              <TypeIcon type={p.type} className="h-7 w-7" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{p.name}</h1>
              <p className="mt-1 max-w-2xl text-slate-600">{p.summary}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <TypeBadge type={p.type} />
                <VersionChip version={p.current_version} />
                <RiskBadge level={p.risk_level} score={p.risk_score} />
                <StatusBadge status={p.status} />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ShareButton />
            <a
              href={`/api/plugins/${p.id}/download`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Download className="h-4 w-4" /> Download
            </a>
            {(isAuthor || isAdmin) && (
              <Link
                href={`/plugins/${p.slug}/new-version`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Upload className="h-4 w-4" /> New version
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-6">
          <Tabs
            tabs={[
              {
                id: "about",
                label: "About",
                content: p.about ? (
                  <div className="prose prose-slate max-w-none"><p>{p.about}</p></div>
                ) : (
                  <p className="text-sm text-slate-500">No description provided.</p>
                ),
              },
              {
                id: "readme",
                label: "README",
                content: p.readme ? (
                  <Markdown>{p.readme}</Markdown>
                ) : (
                  <p className="text-sm text-slate-500">No README provided.</p>
                ),
              },
              {
                id: "faq",
                label: `FAQ${p.faq.length ? ` (${p.faq.length})` : ""}`,
                content: p.faq.length ? (
                  <FaqAccordion items={p.faq} />
                ) : (
                  <p className="text-sm text-slate-500">No FAQs yet.</p>
                ),
              },
              {
                id: "versions",
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <GitBranch className="h-3.5 w-3.5" /> Versions ({versions.length})
                  </span>
                ),
                content: (
                  <ul className="space-y-3">
                    {versions.map((v) => (
                      <li key={v.id} className="rounded-xl border border-slate-200 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <VersionChip version={v.version} />
                            {v.version === p.current_version && (
                              <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">CURRENT</span>
                            )}
                            <span className="text-xs text-slate-400">
                              by {v.author_name ?? "unknown"} · {fmtDate(v.created_at)}
                            </span>
                          </div>
                          {v.file_path && (
                            <a
                              href={`/api/plugins/${p.id}/download?v=${encodeURIComponent(v.version)}`}
                              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
                            >
                              <Download className="h-3.5 w-3.5" /> {p.slug}-{v.version}.zip
                            </a>
                          )}
                        </div>
                        {v.changelog && <p className="mt-2 text-sm text-slate-600">{v.changelog}</p>}
                      </li>
                    ))}
                  </ul>
                ),
              },
              {
                id: "activity",
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <History className="h-3.5 w-3.5" /> Activity
                  </span>
                ),
                content: (
                  <ol className="relative space-y-4 border-l border-slate-200 pl-5">
                    {activity.length === 0 && <li className="text-sm text-slate-500">No activity yet.</li>}
                    {activity.map((a) => {
                      let details: Record<string, unknown> = {};
                      try {
                        details = JSON.parse(a.details);
                      } catch { /* ignore */ }
                      return (
                        <li key={a.id} className="relative">
                          <span className="absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-indigo-400" />
                          <p className="text-sm text-slate-700">
                            <span className="font-medium">{a.actor_name}</span> {describeAudit(a.action)}
                            {typeof details.version === "string" && (
                              <span className="font-mono text-xs text-slate-500"> v{details.version}</span>
                            )}
                            {typeof details.team === "string" && (
                              <span className="text-slate-500"> — {details.team}</span>
                            )}
                          </p>
                          {typeof details.notes === "string" && details.notes && (
                            <p className="mt-0.5 text-xs italic text-slate-500">“{details.notes}”</p>
                          )}
                          <p className="text-xs text-slate-400">{fmtDateTime(a.created_at)}</p>
                        </li>
                      );
                    })}
                  </ol>
                ),
              },
            ]}
          />
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Install</h3>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-slate-900 px-3 py-2 font-mono text-xs text-slate-100">
                {p.install_command}
              </code>
              <CopyButton text={p.install_command} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Details</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Author</dt><dd className="font-medium text-slate-800">{p.author_name}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Downloads</dt><dd className="font-medium text-slate-800">{p.downloads}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Published</dt><dd className="font-medium text-slate-800">{fmtDate(p.created_at)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Updated</dt><dd className="font-medium text-slate-800">{fmtDate(p.updated_at)}</dd></div>
            </dl>
            {p.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1 border-t border-slate-100 pt-3">
                {p.tags.map((t) => (
                  <Link key={t} href={`/?tag=${encodeURIComponent(t)}`} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-indigo-50 hover:text-indigo-700">
                    {t}
                  </Link>
                ))}
              </div>
            )}
            {p.permissions.length > 0 && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Declared permissions</p>
                <ul className="space-y-1">
                  {p.permissions.map((perm) => (
                    <li key={perm} className="text-xs text-slate-600">
                      {PERMISSIONS.find((x) => x.id === perm)?.label ?? perm}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <Users className="h-4 w-4 text-slate-400" /> Teams using this
            </h3>
            {p.teams.length > 0 ? (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {p.teams.map((t) => (
                  <span key={t.id} className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                    {t.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mb-3 text-xs text-slate-500">No teams have marked this yet.</p>
            )}
            {user && <TeamUsageToggle pluginId={p.id} pluginName={p.name} teams={usageTeams} />}
          </div>

          {(isAuthor || isAdmin) && latestSub && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <ShieldAlert className="h-4 w-4 text-slate-400" /> Governance
              </h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Latest scan</dt>
                  <dd><RiskBadge level={latestSub.risk_level} score={latestSub.risk_score} /></dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Pending reviews</dt>
                  <dd className="font-medium text-slate-800">{pendingSubs.length}</dd>
                </div>
              </dl>
              <Link
                href={`/submissions/${latestSub.id}`}
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline"
              >
                View full scan report →
              </Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
