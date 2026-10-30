import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getPlaybookBySlug, listPlugins } from "@/lib/queries";
import { updatePlaybookAction } from "@/lib/actions";
import { PlaybookForm } from "@/components/playbook-form";

export default async function EditPlaybookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const pb = getPlaybookBySlug(slug);
  if (!pb) notFound();
  if (pb.author_id !== user.id && !user.is_admin) redirect(`/playbooks/${slug}`);

  const plugins = listPlugins({ sort: "name" }).map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    summary: p.summary,
    tags: p.tags,
  }));

  const bound = updatePlaybookAction.bind(null, pb.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`/playbooks/${slug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Back to {pb.name}
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Edit playbook</h1>
        <p className="mt-1 text-sm text-slate-500">Changes are saved immediately and audit-logged.</p>
      </div>
      <PlaybookForm
        action={bound}
        plugins={plugins}
        initial={{ name: pb.name, description: pb.description, items: pb.items.map((i) => i.id) }}
        submitLabel="Save changes"
      />
    </div>
  );
}
