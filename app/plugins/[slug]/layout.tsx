import { notFound } from "next/navigation";
import { canViewPlugin, getCurrentUser } from "@/lib/auth";
import { getPluginBySlug } from "@/lib/queries";

/**
 * Existence check lives in the layout: it renders outside this segment's
 * loading.tsx Suspense boundary, so notFound() thrown here produces a real
 * HTTP 404 instead of a streamed 200.
 */
export default async function PluginLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = getPluginBySlug(slug);
  const user = await getCurrentUser();
  if (!p || !canViewPlugin(p, user)) notFound();
  return <>{children}</>;
}
