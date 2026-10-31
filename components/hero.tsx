import { AuroraBackdrop } from "./aurora-backdrop";
import { TypeIcon } from "./badges";
import { StarRow } from "./stars";
import { AgentRotator, HeroCtas, NumberTicker } from "./hero-client";
import { HeroTerminal, type TerminalItem } from "./hero-terminal";

export interface HeroFloatItem {
  name: string;
  type: string;
  rating_avg: number;
  rating_count: number;
}

export function Hero({
  stats,
  terminal,
  floats,
}: {
  stats: { items: number; installs: number; teams: number; playbooks: number };
  terminal?: { playbookSlug: string; items: TerminalItem[] };
  floats?: HeroFloatItem[];
}) {
  const rows: { value: number; label: string }[] = [
    { value: stats.items, label: "catalog items" },
    { value: stats.installs, label: "installs" },
    { value: stats.teams, label: "teams" },
    { value: stats.playbooks, label: "playbooks" },
  ];
  return (
    <section
      aria-labelledby="hero-title"
      className="spotlight relative overflow-hidden rounded-3xl bg-gradient-to-b from-indigo-950 via-slate-950 to-slate-950 shadow-2xl shadow-indigo-950/30 ring-1 ring-white/10"
      style={{ ["--spotlight-radius" as string]: "620px", ["--spotlight-color" as string]: "rgb(129 140 248 / 0.16)" }}
    >
      <AuroraBackdrop />

      <div className="relative grid items-center gap-10 px-6 py-16 sm:px-12 sm:py-20 lg:grid-cols-[1fr_360px]">
        <div>
          <span
            className="enter inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-indigo-200"
            style={{ ["--i" as string]: 0 }}
          >
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_2px_rgb(52_211_153/0.6)]" />
            Official Acme agent catalog · every item security-scanned
          </span>

          <h1
            id="hero-title"
            className="enter mt-6 max-w-3xl text-4xl font-extrabold tracking-tight text-white sm:text-6xl"
            style={{ ["--i" as string]: 1 }}
          >
            <span className="block">One catalog.</span>
            <span className="shimmer-text block">Every agent.</span>
          </h1>

          <p className="enter mt-5 max-w-2xl text-base leading-relaxed text-indigo-200/90 sm:text-lg" style={{ ["--i" as string]: 2 }}>
            Skills, MCP servers, plugins and playbooks: security-scanned, admin-approved, one command to
            install in <AgentRotator />
          </p>

          <div className="enter" style={{ ["--i" as string]: 3 }}>
            <HeroCtas />
          </div>

          <dl className="enter mt-12 grid max-w-2xl grid-cols-2 gap-6 border-t border-white/10 pt-8 sm:grid-cols-4" style={{ ["--i" as string]: 4 }}>
            {rows.map((r) => (
              <div key={r.label}>
                <dt className="sr-only">{r.label}</dt>
                <dd>
                  <NumberTicker value={r.value} className="text-3xl font-bold tracking-tight text-white" />
                  <span className="mt-1 block text-xs font-medium uppercase tracking-wider text-indigo-300/80">
                    {r.label}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* product visual — lg+ only */}
        {terminal && (
          <div className="relative hidden lg:block">
            {floats?.map((f, idx) => (
              <div
                key={f.name}
                aria-hidden="true"
                className={`pointer-events-none absolute z-0 w-44 rounded-xl bg-white/[.07] p-3 ring-1 ring-white/10 backdrop-blur-md ${
                  idx === 0 ? "float-a -left-14 -top-8" : "float-b -bottom-8 -right-8"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-indigo-200">
                    <TypeIcon type={f.type} className="h-3.5 w-3.5" />
                  </span>
                  <span className="truncate text-xs font-semibold text-slate-200">{f.name}</span>
                </div>
                <div className="mt-1.5 text-[10px] text-slate-400 [&_svg]:h-2.5 [&_svg]:w-2.5">
                  <StarRow avg={f.rating_avg} count={f.rating_count} />
                </div>
              </div>
            ))}
            <HeroTerminal playbookSlug={terminal.playbookSlug} items={terminal.items} />
          </div>
        )}
      </div>
    </section>
  );
}
