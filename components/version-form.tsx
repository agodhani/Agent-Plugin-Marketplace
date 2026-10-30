"use client";

import { useActionState } from "react";
import { submitVersionAction, type ActionState } from "@/lib/actions";

const input =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

export function VersionForm({ pluginId }: { pluginId: number }) {
  const bound = submitVersionAction.bind(null, pluginId);
  const [state, action, pending] = useActionState<ActionState, FormData>(bound, {});
  return (
    <form action={action} className="max-w-xl space-y-5 rounded-xl border border-slate-200 bg-white p-6">
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">New version *</label>
        <input name="version" required placeholder="1.1.0" className={input} />
        <p className="mt-1 text-xs text-slate-400">Must be unique for this plugin — semver recommended.</p>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Changelog *</label>
        <textarea name="changelog" required rows={4} className={input} placeholder="What changed in this version?" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Updated archive (.zip)</label>
        <input
          name="file"
          type="file"
          accept=".zip,application/zip"
          className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-indigo-700"
        />
        <p className="mt-1 text-xs text-slate-400">Re-scanned on submit. An admin must approve before it becomes current.</p>
      </div>
      <button
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {pending ? "Scanning & submitting…" : "Submit version for review"}
      </button>
    </form>
  );
}
