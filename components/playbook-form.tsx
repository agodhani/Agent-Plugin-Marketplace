"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/actions";
import { PluginPicker, type PickerItem } from "./plugin-picker";

const input =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

export function PlaybookForm({
  action,
  plugins,
  initial,
  submitLabel = "Create playbook",
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  plugins: PickerItem[];
  initial?: { name: string; description: string; items: number[] };
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});
  return (
    <form action={formAction} className="space-y-6">
      {state.error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Playbook name *</label>
            <input name="name" required defaultValue={initial?.name} className={input} placeholder="Frontend Agent Kit" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
            <input name="description" defaultValue={initial?.description} className={input} placeholder="What is this bundle for?" />
          </div>
        </div>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-1 font-semibold text-slate-900">Pick the plugins *</h2>
        <p className="mb-4 text-sm text-slate-500">
          Anyone can then install the whole set with one command: <code className="rounded bg-slate-100 px-1">amp playbook install &lt;slug&gt;</code>
        </p>
        <PluginPicker plugins={plugins} initialSelected={initial?.items} />
      </section>
      <button
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
