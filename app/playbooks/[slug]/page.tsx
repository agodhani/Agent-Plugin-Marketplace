import { PageHeader } from "@/components/page-header";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ListChecks, Pencil } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getPlaybookBySlug, myPlaybooks } from "@/lib/queries";
import { TypeBadge } from "@/components/badges";
import { CopyButton, ShareButton } from "@/components/copy-button";
import { PluginCard } from "@/components/plugin-card";
import { DeletePlaybookButton } from "@/components/delete-playbook-button";
import { fmtDate } from "@/lib/utils";

export default async function PlaybookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [user, pb] = await Promise.all([getCurrentUser(), Promise.resolve(getPlaybookBySlug(slug))]);
  if (!pb) notFound();
  const canEdit = !!user && (user.id === pb.author_id || !!user.is_admin);
  const installCmd = `agenthub playbook install ${pb.slug}`;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-fuchsia-100 text-fuchsia-600">
              <ListChecks className="h-7 w-7" />
            </span>
            <div>
              <PageHeader
                eyebrow="Playbook"
                title={pb.name}
                subtitle={pb.description || "A curated bundle of catalog items."}
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                  {pb.item_count} item{pb.item_count === 1 ? "" : "s"}
                </span>
                {pb.types.map((t) => (
                  <TypeBadge key={t} type={t} />
                ))}
                <span className="text-xs text-slate-400">
                  by {pb.author_name} · created {fmtDate(pb.created_at)} · updated {fmtDate(pb.updated_at)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ShareButton />
            {canEdit && (
              <>
                <Link
                  href={`/playbooks/${pb.slug}/edit`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Pencil className="h-4 w-4" /> Edit
                </Link>
                <DeletePlaybookButton playbookId={pb.id} />
              </>
            )}
          </div>
        </div>
        <div className="enter mt-5 overflow-hidden rounded-2xl bg-slate-950/90 shadow-lg shadow-indigo-950/30 ring-1 ring-white/10" style={{ ["--i" as string]: 3 }}>
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
              <span className="ml-2 text-[10px] font-medium text-slate-500">install playbook · {pb.item_count} item{pb.item_count === 1 ? "" : "s"}</span>
            </span>
            <CopyButton text={installCmd} label="Copy command" className="border-0 !bg-white/10 !text-slate-300 hover:!bg-white/20" />
          </div>
          <div className="px-4 py-3.5 font-mono text-sm">
            <span className="mr-2 text-emerald-400">$</span>
            <span className="text-slate-100">{installCmd}</span>
          </div>
        </div>
      </div>

      <section>
        <h2 className="mb-3 font-semibold text-slate-900">Included plugins</h2>
        {pb.items.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
            This playbook is empty{canEdit ? " — edit it to add items" : ""}.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pb.items.map((p, idx) => (
              <PluginCard key={p.id} p={p} i={idx} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
