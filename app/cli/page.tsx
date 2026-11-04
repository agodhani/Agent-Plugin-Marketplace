import Link from "next/link";
import { headers } from "next/headers";
import { PageHeader } from "@/components/page-header";
import { CopyButton } from "@/components/copy-button";

function Block({ cmd, label = "terminal" }: { cmd: string; label?: string }) {
  return (
    <div className="mt-2 overflow-hidden rounded-lg bg-slate-900">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-1.5">
        <span className="truncate font-mono text-[11px] text-slate-400">{label}</span>
        <CopyButton text={cmd} className="border-0 !bg-transparent !px-1.5 !py-0.5 !text-slate-300 hover:!bg-white/10" />
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap break-words p-3 font-mono text-xs leading-relaxed text-slate-100">{cmd}</pre>
    </div>
  );
}

const ROWS = [
  { agent: "Claude Code", flag: "--agent claude", skills: ".claude/skills/<slug>", mcp: ".mcp.json" },
  { agent: "Cursor", flag: "--agent cursor", skills: ".cursor/skills/<slug>", mcp: ".cursor/mcp.json" },
  { agent: "Devin", flag: "--agent devin", skills: ".devin/skills/<slug>", mcp: ".devin/mcp_config.json" },
  { agent: "Generic (default)", flag: "--agent generic", skills: ".agents/skills/<slug>", mcp: "— (snippet printed)" },
];

export default async function CliPage() {
  const h = await headers();
  const origin = h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader eyebrow="Install" title="AgentHub CLI" subtitle="Install catalog items straight into your agent's config." />
      <ol className="mt-8 space-y-8">
        <li>
          <h2 className="font-semibold text-slate-900">1 · Create a token</h2>
          <p className="mt-1 text-sm text-slate-600">
            Open <Link href="/profile#tokens" className="font-medium text-indigo-600 hover:underline">your profile → Access tokens</Link> and
            create a token. It can read and download catalog items — it can't change anything.
          </p>
        </li>
        <li>
          <h2 className="font-semibold text-slate-900">2 · Install the CLI</h2>
          <Block cmd={`mkdir -p ~/.agenthub && curl -fsSL ${origin}/agenthub.mjs -o ~/.agenthub/agenthub.mjs`} />
          <Block cmd={`alias agenthub="node ~/.agenthub/agenthub.mjs"  # add to your shell profile`} />
        </li>
        <li>
          <h2 className="font-semibold text-slate-900">3 · Log in</h2>
          <Block cmd={`agenthub login --url ${origin} --token <token>`} />
        </li>
        <li>
          <h2 className="font-semibold text-slate-900">4 · Install</h2>
          <Block cmd={"agenthub install github-mcp --agent claude\nagenthub playbook install frontend-agent-kit --agent cursor"} />
        </li>
      </ol>
      <h2 className="mt-10 font-semibold text-slate-900">Where things go</h2>
      <table className="mt-3 w-full text-left text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-slate-400">
            <th className="py-2 pr-4 font-semibold">Agent</th>
            <th className="py-2 pr-4 font-semibold">Flag</th>
            <th className="py-2 pr-4 font-semibold">Skills go to</th>
            <th className="py-2 font-semibold">MCP config</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {ROWS.map((r) => (
            <tr key={r.agent}>
              <td className="py-2.5 pr-4 font-medium text-slate-800">{r.agent}</td>
              <td className="py-2.5 pr-4 font-mono text-xs text-slate-600">{r.flag}</td>
              <td className="py-2.5 pr-4 font-mono text-xs text-slate-600">{r.skills}</td>
              <td className="py-2.5 font-mono text-xs text-slate-600">{r.mcp}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-xs text-slate-500">MCP, plugin and documentation packages always install to <code className="rounded bg-slate-100 px-1">.agenthub/&lt;slug&gt;</code>.</p>
    </div>
  );
}
