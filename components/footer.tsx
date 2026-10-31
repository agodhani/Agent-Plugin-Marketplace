import Link from "next/link";
import { Boxes, ShieldCheck } from "lucide-react";

const COLS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Catalog",
    links: [
      { href: "/", label: "All items" },
      { href: "/playbooks", label: "Playbooks" },
      { href: "/favorites", label: "Favorites" },
      { href: "/compare", label: "Compare" },
    ],
  },
  {
    title: "Contribute",
    links: [
      { href: "/submit", label: "Submit a plugin" },
      { href: "/teams", label: "Teams" },
      { href: "/profile", label: "Your profile" },
    ],
  },
];

export function Footer({ isAdmin }: { isAdmin: boolean }) {
  return (
    <footer className="border-t border-slate-200 bg-white/60">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1.2fr]">
          <div>
            <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/40">
                <Boxes className="h-4 w-4" />
              </span>
              AgentHub
            </Link>
            <p className="mt-3 max-w-xs text-sm text-slate-500">
              The internal marketplace for agent skills, MCP servers, plugins and playbooks.
            </p>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
              <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />
              All systems operational
            </p>
          </div>
          {COLS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{col.title}</h3>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.href + l.label}>
                    <Link href={l.href} className="text-sm text-slate-600 transition duration-200 hover:text-indigo-700">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          <nav aria-label="Governance">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Governance</h3>
            <ul className="mt-3 space-y-2">
              {isAdmin && (
                <li>
                  <Link href="/admin" className="text-sm text-slate-600 transition duration-200 hover:text-indigo-700">
                    Review queue
                  </Link>
                </li>
              )}
              <li className="flex items-start gap-2 text-sm text-slate-500">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                Every submission is validation-scanned, security-scanned and admin-approved
              </li>
            </ul>
          </nav>
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6 text-xs text-slate-400">
          <span>© 2026 Acme · AgentHub</span>
          <span>Works with Claude Code, Cursor, Amp, Devin, Copilot</span>
        </div>
      </div>
    </footer>
  );
}
