import Link from "next/link";
import { ListChecks } from "lucide-react";
import { TypeBadge } from "./badges";
import { fmtDate } from "@/lib/utils";
import type { PlaybookListItem } from "@/lib/queries";

export function PlaybookCard({ pb }: { pb: PlaybookListItem }) {
  return (
    <Link
      href={`/playbooks/${pb.slug}`}
      style={{ ["--accent" as string]: "linear-gradient(90deg,#c026d3,#f0abfc)" }}
      className="card-accent spotlight group relative flex flex-col rounded-2xl bg-white p-4 pt-5 ring-1 ring-slate-200 transition duration-200 hover:-translate-y-1 hover:border-fuchsia-200 hover:shadow-xl hover:shadow-fuchsia-200/60"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-fuchsia-100 text-fuchsia-600">
          <ListChecks className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0">
          <div className="font-semibold text-slate-900 group-hover:text-indigo-700">{pb.name}</div>
          <p className="mt-0.5 text-xs text-slate-400">by {pb.author_name} · updated {fmtDate(pb.updated_at)}</p>
        </div>
        <span className="ml-auto shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
          {pb.item_count} item{pb.item_count === 1 ? "" : "s"}
        </span>
      </div>
      <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-relaxed text-slate-600">{pb.description || "A curated bundle of catalog items."}</p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
        {pb.types.map((t) => (
          <TypeBadge key={t} type={t} />
        ))}
        <code className="ml-auto rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-500">
          agenthub playbook install {pb.slug}
        </code>
      </div>
    </Link>
  );
}
