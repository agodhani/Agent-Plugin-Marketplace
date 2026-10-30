import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getPluginBySlug } from "@/lib/queries";
import { VersionForm } from "@/components/version-form";

export default async function NewVersionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const p = getPluginBySlug(slug);
  if (!p) notFound();
  if (p.author_id !== user.id && !user.is_admin) redirect(`/plugins/${slug}`);

  return (
    <div className="space-y-6">
      <Link href={`/plugins/${slug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Back to {p.name}
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Submit a new version</h1>
        <p className="mt-1 text-sm text-slate-500">
          {p.name} is currently at <span className="font-mono">v{p.current_version}</span>. New versions are re-scanned
          and require admin approval before publishing.
        </p>
      </div>
      <VersionForm pluginId={p.id} />
    </div>
  );
}
