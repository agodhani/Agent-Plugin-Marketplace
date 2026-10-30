import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileArchive } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getSubmission } from "@/lib/queries";
import { RiskBadge, StatusBadge, TypeBadge } from "@/components/badges";
import { ScanReport } from "@/components/scan-report";
import { ReviewPanel } from "@/components/review-panel";
import { computeRisk, type SecurityFinding } from "@/lib/scan";
import { fmtDateTime, PERMISSIONS } from "@/lib/utils";

export default async function SubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const sub = getSubmission(Number(id));
  if (!sub) notFound();

  const db = getDb();
  const plugin = sub.plugin_id
    ? (db.prepare(`SELECT author_id FROM plugins WHERE id = ?`).get(sub.plugin_id) as { author_id: number } | undefined)
    : undefined;
  const canSee = !!user && (user.is_admin || user.id === sub.submitted_by || user.id === plugin?.author_id);
  if (!canSee) notFound();

  let permissions: string[] = [];
  try {
    const manifest = JSON.parse(sub.manifest) as { permissions?: string[] };
    if (Array.isArray(manifest.permissions)) permissions = manifest.permissions;
  } catch { /* ignore */ }

  let findings: SecurityFinding[] = [];
  try {
    findings = JSON.parse(sub.security_report);
  } catch { /* ignore */ }
  const counts = { low: 0, medium: 0, high: 0 };
  for (const f of findings) counts[f.severity]++;
  const { permissionScore, findingScore } = computeRisk(permissions, counts);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href={user?.is_admin ? "/admin" : "/profile"} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Submission #{sub.id} · {sub.kind === "new" ? "New catalog entry" : "Version update"}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              {sub.plugin_slug ? <Link href={`/plugins/${sub.plugin_slug}`} className="hover:text-indigo-700">{sub.plugin_name}</Link> : sub.plugin_name}
              <span className="ml-2 font-mono text-lg font-normal text-slate-400">v{sub.version}</span>
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <TypeBadge type={sub.plugin_type} />
              <StatusBadge status={sub.status} />
              <RiskBadge level={sub.risk_level} score={sub.risk_score} />
            </div>
          </div>
          {sub.file_path && (
            <a
              href={`/api/submissions/${sub.id}/download`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <FileArchive className="h-4 w-4" /> Download archive
            </a>
          )}
        </div>
        <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-3">
          <div><dt className="text-xs text-slate-400">Submitted by</dt><dd className="font-medium text-slate-700">{sub.submitter_name}</dd></div>
          <div><dt className="text-xs text-slate-400">Submitted</dt><dd className="font-medium text-slate-700">{fmtDateTime(sub.created_at)}</dd></div>
          <div>
            <dt className="text-xs text-slate-400">Reviewed</dt>
            <dd className="font-medium text-slate-700">
              {sub.reviewed_at ? `${fmtDateTime(sub.reviewed_at)} by ${sub.reviewer_name}` : "—"}
            </dd>
          </div>
        </dl>
        {sub.changelog && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">“{sub.changelog}”</p>}
        {sub.review_notes && (
          <p className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
            <span className="font-medium">Review notes:</span> {sub.review_notes}
          </p>
        )}
        {permissions.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Declared permissions</p>
            <div className="flex flex-wrap gap-1.5">
              {permissions.map((perm) => (
                <span key={perm} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                  {PERMISSIONS.find((x) => x.id === perm)?.label ?? perm}
                  {PERMISSIONS.find((x) => x.id === perm) && (
                    <span className="ml-1 text-slate-400">+{PERMISSIONS.find((x) => x.id === perm)!.weight}</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <ScanReport
        validationJson={sub.validation_report}
        findingsJson={sub.security_report}
        riskScore={sub.risk_score}
        riskLevel={sub.risk_level}
        permissionScore={permissionScore}
        findingScore={findingScore}
      />

      {user?.is_admin === 1 && sub.status === "pending" && <ReviewPanel submissionId={sub.id} />}
    </div>
  );
}
