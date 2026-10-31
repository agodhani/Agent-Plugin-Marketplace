import { PageHeader } from "@/components/page-header";
import Link from "next/link";
import { ListChecks, Plus } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { listPlaybooks } from "@/lib/queries";
import { PlaybookCard } from "@/components/playbook-card";

export default async function PlaybooksPage() {
  const user = await getCurrentUser();
  const playbooks = listPlaybooks();
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catalog"
        title="Playbooks"
        subtitle="Curated bundles of catalog items — install a whole toolkit with a single command."
        actions={user && (
          <Link
            href="/playbooks/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" /> New playbook
          </Link>
        )}
      />
      {playbooks.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <ListChecks className="h-10 w-10 text-slate-300" />
          <p className="mt-3 font-medium text-slate-700">No playbooks yet</p>
          <p className="mt-1 text-sm text-slate-500">Bundle a set of skills, MCPs and plugins into a one-command install.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {playbooks.map((pb) => (
            <PlaybookCard key={pb.id} pb={pb} />
          ))}
        </div>
      )}
    </div>
  );
}
