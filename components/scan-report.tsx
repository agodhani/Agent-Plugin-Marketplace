import { AlertTriangle, CheckCircle2, Info, ShieldAlert, XCircle } from "lucide-react";
import { RiskBadge } from "./badges";
import type { SecurityFinding, ValidationCheck } from "@/lib/scan";

function CheckIcon({ c }: { c: ValidationCheck }) {
  if (c.passed) return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />;
  if (c.severity === "error") return <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />;
  if (c.severity === "warning") return <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />;
  return <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />;
}

const SEV_BADGE: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-slate-100 text-slate-600",
};

export function ScanReport({
  validationJson,
  findingsJson,
  riskScore,
  riskLevel,
  permissionScore,
  findingScore,
}: {
  validationJson: string;
  findingsJson: string;
  riskScore: number;
  riskLevel: string;
  permissionScore?: number;
  findingScore?: number;
}) {
  let checks: ValidationCheck[] = [];
  let findings: SecurityFinding[] = [];
  try {
    checks = JSON.parse(validationJson);
  } catch { /* ignore */ }
  try {
    findings = JSON.parse(findingsJson);
  } catch { /* ignore */ }

  const counts = { low: 0, medium: 0, high: 0 };
  for (const f of findings) counts[f.severity]++;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <RiskBadge level={riskLevel} score={riskScore} />
        {permissionScore !== undefined && (
          <p className="text-sm text-slate-500">
            <span className="font-medium text-slate-700">{permissionScore}</span> pts from declared permissions
            {findingScore !== undefined && (
              <>
                {" "}+ <span className="font-medium text-slate-700">{findingScore}</span> pts from scan findings
              </>
            )}
          </p>
        )}
        <div className="ml-auto flex gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-500" /> {counts.high} high
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-500" /> {counts.medium} medium
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-slate-400" /> {counts.low} low
          </span>
        </div>
      </div>

      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <CheckCircle2 className="h-4 w-4 text-slate-400" /> Validation checks
        </h3>
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {checks.map((c) => (
            <li key={c.id} className="flex items-start gap-3 px-4 py-2.5">
              <CheckIcon c={c} />
              <div>
                <div className="text-sm font-medium text-slate-800">{c.label}</div>
                <div className="text-xs text-slate-500">{c.message}</div>
              </div>
            </li>
          ))}
          {checks.length === 0 && <li className="px-4 py-3 text-sm text-slate-500">No validation report recorded.</li>}
        </ul>
      </div>

      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <ShieldAlert className="h-4 w-4 text-slate-400" /> Security findings
        </h3>
        {findings.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
            No security findings detected.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Severity</th>
                  <th className="px-4 py-2 font-medium">Rule</th>
                  <th className="px-4 py-2 font-medium">Location</th>
                  <th className="px-4 py-2 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {findings.map((f, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SEV_BADGE[f.severity]}`}>{f.severity}</span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{f.rule}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">
                      {f.file}:{f.line}
                      {f.occurrences > 1 && <span className="text-slate-400"> ×{f.occurrences}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{f.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
