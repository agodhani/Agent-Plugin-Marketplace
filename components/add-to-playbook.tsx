"use client";

import { useTransition } from "react";
import { Check, Plus } from "lucide-react";
import { togglePlaybookItemAction } from "@/lib/actions";

export function AddToPlaybook({
  pluginId,
  playbooks,
}: {
  pluginId: number;
  playbooks: { id: number; name: string; contains: boolean }[];
}) {
  const [pending, start] = useTransition();
  if (playbooks.length === 0) {
    return <p className="text-xs text-slate-500">Create a playbook to bundle this with other plugins.</p>;
  }
  return (
    <div className="space-y-1.5">
      {playbooks.map((pb) => (
        <button
          key={pb.id}
          disabled={pending}
          onClick={() => start(async () => { await togglePlaybookItemAction(pb.id, pluginId, !pb.contains); })}
          className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition disabled:opacity-50 ${
            pb.contains
              ? "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-800"
              : "border-slate-200 bg-white text-slate-600 hover:border-fuchsia-300 hover:text-fuchsia-700"
          }`}
        >
          <span
            className={`flex h-4 w-4 items-center justify-center rounded border ${
              pb.contains ? "border-fuchsia-500 bg-fuchsia-500 text-white" : "border-slate-300"
            }`}
          >
            {pb.contains && <Check className="h-3 w-3" />}
          </span>
          <span className="flex-1 font-medium">{pb.name}</span>
          {!pb.contains && <Plus className="h-3.5 w-3.5 text-slate-400" />}
        </button>
      ))}
      <p className="pt-1 text-[11px] text-slate-400">Add to or remove from your playbooks.</p>
    </div>
  );
}
