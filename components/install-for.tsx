"use client";

import { useState } from "react";
import { CopyButton } from "./copy-button";
import { buildInstall, type Target, type TrayItem } from "./tray";

const TARGETS: { id: Target; label: string }[] = [
  { id: "amp", label: "AgentHub CLI" },
  { id: "claude", label: "Claude Code" },
  { id: "cursor", label: "Cursor" },
];

const WORKS_WITH = ["Amp", "Claude Code", "Cursor", "Devin", "Copilot"];

const FILE_LABEL: Record<Target, string> = {
  amp: "terminal",
  claude: "~/.claude/mcp.json",
  cursor: ".cursor/mcp.json",
  download: "terminal",
};

export function InstallFor({ item }: { item: TrayItem }) {
  const [target, setTarget] = useState<Target>("amp");
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const command = buildInstall(target, [item], origin);

  return (
    <div>
      <div className="flex rounded-lg border border-slate-200 p-1" role="group" aria-label="Install for">
        {TARGETS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTarget(t.id)}
            className={`flex-1 whitespace-nowrap rounded-md px-1.5 py-1.5 text-xs font-medium transition duration-200 ${
              target === t.id ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-3 overflow-hidden rounded-lg bg-slate-900">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-1.5">
          <span className="truncate font-mono text-[11px] text-slate-400">{FILE_LABEL[target]}</span>
          <CopyButton text={command} className="border-0 !bg-transparent !px-1.5 !py-0.5 !text-slate-300 hover:!bg-white/10" />
        </div>
        <pre className="max-h-48 overflow-x-auto whitespace-pre p-3 font-mono text-[11px] leading-relaxed text-slate-100">{command}</pre>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Works with</span>
        {WORKS_WITH.map((a) => (
          <span key={a} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
            {a}
          </span>
        ))}
      </div>
    </div>
  );
}
