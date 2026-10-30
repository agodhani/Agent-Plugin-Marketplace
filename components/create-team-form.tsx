"use client";

import { useActionState } from "react";
import { createTeamAction, type ActionState } from "@/lib/actions";
import { Plus } from "lucide-react";

export function CreateTeamForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createTeamAction, {});
  return (
    <form action={action} className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="mb-3 font-semibold text-slate-900">Create a team</h3>
      {state.error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <div className="space-y-3">
        <input
          name="name"
          required
          placeholder="Team name"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />
        <input
          name="description"
          placeholder="What does this team own?"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />
        <button
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> {pending ? "Creating…" : "Create team"}
        </button>
      </div>
    </form>
  );
}
