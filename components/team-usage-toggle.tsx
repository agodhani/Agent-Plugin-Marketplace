"use client";

import { useTransition } from "react";
import { Check, Plus } from "lucide-react";
import { setTeamUsageAction } from "@/lib/actions";

export function TeamUsageToggle({
  pluginId,
  teams,
}: {
  pluginId: number;
  teams: { id: number; name: string; used: boolean }[];
}) {
  const [pending, start] = useTransition();
  if (teams.length === 0) {
    return <p className="text-xs text-slate-500">Join a team to mark this as used.</p>;
  }
  return (
    <div className="space-y-1.5">
      {teams.map((t) => (
        <button
          key={t.id}
          disabled={pending}
          onClick={() => start(async () => { await setTeamUsageAction(pluginId, t.id, !t.used); })}
          className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition disabled:opacity-50 ${
            t.used
              ? "border-green-300 bg-green-50 text-green-800"
              : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-700"
          }`}
        >
          <span
            className={`flex h-4 w-4 items-center justify-center rounded border ${
              t.used ? "border-green-500 bg-green-500 text-white" : "border-slate-300"
            }`}
          >
            {t.used && <Check className="h-3 w-3" />}
          </span>
          <span className="flex-1 font-medium">{t.name}</span>
          {!t.used && <Plus className="h-3.5 w-3.5 text-slate-400" />}
        </button>
      ))}
      <p className="pt-1 text-[11px] text-slate-400">Mark which of your teams uses this.</p>
    </div>
  );
}
