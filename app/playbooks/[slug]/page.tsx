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
  const installCmd = `amp playbook install ${pb.slug}`;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-fuchsia-100 text-fuchsia-600">
              <ListChecks className="h-7 w-7" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{pb.name}</h1>
              <p className="mt-1 max-w-2xl text-slate-600">{pb.description || "A curated bundle of catalog items."}</p>
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
        <div className="mt-5 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 pl-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Install all {pb.item_count}</span>
          <code className="min-w-0 flex-1 truncate font-mono text-sm text-slate-800">{installCmd}</code>
          <CopyButton text={installCmd} label="Copy command" />
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
            {pb.items.map((p) => (
              <PluginCard key={p.id} p={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
