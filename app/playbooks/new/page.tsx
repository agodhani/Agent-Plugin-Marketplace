import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listPlugins } from "@/lib/queries";
import { createPlaybookAction } from "@/lib/actions";
import { PlaybookForm } from "@/components/playbook-form";

export default async function NewPlaybookPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const plugins = listPlugins({ sort: "name" }).map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    summary: p.summary,
    tags: p.tags,
  }));
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">New playbook</h1>
        <p className="mt-1 text-sm text-slate-500">
          Pick a set of catalog items and give them a name — anyone can then install the bundle with one command.
        </p>
      </div>
      <PlaybookForm action={createPlaybookAction} plugins={plugins} />
    </div>
  );
}
