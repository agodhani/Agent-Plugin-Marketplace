"use client";

import { useActionState } from "react";
import { submitPluginAction, type ActionState } from "@/lib/actions";
import { PERMISSIONS, PLUGIN_TYPES, TYPE_META } from "@/lib/utils";
import { FaqEditor } from "./faq-editor";

const input =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";
const label = "mb-1 block text-sm font-medium text-slate-700";

export function SubmitForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(submitPluginAction, {});
  return (
    <form action={action} className="space-y-8">
      {state.error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>}

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 font-semibold text-slate-900">Basics</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Name *</label>
            <input name="name" required className={input} placeholder="My Awesome Skill" />
          </div>
          <div>
            <label className={label}>Type *</label>
            <select name="type" className={input} defaultValue="skill">
              {PLUGIN_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_META[t].label} — {TYPE_META[t].hint}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Summary *</label>
            <input name="summary" required className={input} placeholder="One-line description shown on cards" />
          </div>
          <div>
            <label className={label}>Version *</label>
            <input name="version" required defaultValue="1.0.0" className={input} />
          </div>
          <div>
            <label className={label}>Install command</label>
            <input name="install_command" className={input} placeholder="amp install my-skill" />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Tags (comma separated)</label>
            <input name="tags" className={input} placeholder="github, productivity, typescript" />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-1 font-semibold text-slate-900">Files</h2>
        <p className="mb-4 text-sm text-slate-500">
          Upload a <code className="rounded bg-slate-100 px-1">.zip</code> of the plugin contents. It will be extracted,
          validated and security-scanned before review. Max 50 MB.
        </p>
        <input
          name="file"
          type="file"
          accept=".zip,application/zip"
          className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
        />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-1 font-semibold text-slate-900">Permissions</h2>
        <p className="mb-4 text-sm text-slate-500">
          Declare what your plugin needs. These feed the risk score shown to reviewers and users.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {PERMISSIONS.map((p) => (
            <label key={p.id} className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 text-sm hover:bg-slate-50">
              <input type="checkbox" name="permissions" value={p.id} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
              <span className="flex-1 text-slate-700">{p.label}</span>
              <span className="text-xs text-slate-400">risk +{p.weight}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 font-semibold text-slate-900">Documentation</h2>
        <div className="space-y-4">
          <div>
            <label className={label}>About</label>
            <textarea name="about" rows={3} className={input} placeholder="What does it do? Who is it for?" />
          </div>
          <div>
            <label className={label}>README (markdown)</label>
            <textarea
              name="readme"
              rows={8}
              className={`${input} font-mono text-xs`}
              placeholder={"## Usage\n\n```bash\namp install my-skill\n```"}
            />
          </div>
          <div>
            <label className={label}>FAQs</label>
            <FaqEditor />
          </div>
          <div>
            <label className={label}>Changelog *</label>
            <textarea name="changelog" rows={2} className={input} placeholder="Initial release" defaultValue="Initial release." />
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-500">
          Submission runs a <strong>validation</strong> and <strong>security scan</strong>, then enters the admin review queue.
        </p>
        <button
          disabled={pending}
          className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {pending ? "Scanning & submitting…" : "Submit for review"}
        </button>
      </div>
    </form>
  );
}
