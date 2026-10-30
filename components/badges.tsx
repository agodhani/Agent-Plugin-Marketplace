import { FileText, Plug, Puzzle, Sparkles } from "lucide-react";

const TYPE_STYLES: Record<string, string> = {
  skill: "bg-violet-50 text-violet-700 ring-violet-600/20",
  mcp: "bg-sky-50 text-sky-700 ring-sky-600/20",
  plugin: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  documentation: "bg-amber-50 text-amber-700 ring-amber-600/20",
};

const TYPE_LABELS: Record<string, string> = {
  skill: "Skill",
  mcp: "MCP Server",
  plugin: "Plugin",
  documentation: "Docs",
};

export function TypeIcon({ type, className = "h-4 w-4" }: { type: string; className?: string }) {
  switch (type) {
    case "skill":
      return <Sparkles className={className} />;
    case "mcp":
      return <Plug className={className} />;
    case "plugin":
      return <Puzzle className={className} />;
    default:
      return <FileText className={className} />;
  }
}

export function TypeBadge({ type }: { type: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TYPE_STYLES[type] ?? "bg-slate-100 text-slate-700 ring-slate-500/20"}`}>
      <TypeIcon type={type} className="h-3 w-3" />
      {TYPE_LABELS[type] ?? type}
    </span>
  );
}

const RISK_STYLES: Record<string, string> = {
  low: "bg-green-50 text-green-700 ring-green-600/20",
  medium: "bg-yellow-50 text-yellow-800 ring-yellow-600/20",
  high: "bg-red-50 text-red-700 ring-red-600/20",
  unknown: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

export function RiskBadge({ level, score }: { level: string; score?: number }) {
  return (
    <span
      title={score !== undefined ? `Risk score ${score}` : undefined}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${RISK_STYLES[level] ?? RISK_STYLES.unknown}`}
    >
      {level === "unknown" ? "unscanned" : `${level} risk`}
      {score !== undefined && <span className="font-normal opacity-70">· {score}</span>}
    </span>
  );
}

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-green-50 text-green-700 ring-green-600/20",
  pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
  rejected: "bg-red-50 text-red-700 ring-red-600/20",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600 ring-slate-500/20"}`}>
      {status}
    </span>
  );
}

export function VersionChip({ version }: { version: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">
      v{version}
    </span>
  );
}
