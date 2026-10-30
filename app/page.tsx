import { getCurrentUser } from "@/lib/auth";
import { allTags, listPlugins, listTeams } from "@/lib/queries";
import { PluginCard } from "@/components/plugin-card";
import { SearchFilters } from "@/components/search-filters";
import { PackageSearch } from "lucide-react";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const pick = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const q = pick("q");
  const type = pick("type") || "all";
  const tag = pick("tag");
  const team = pick("team");
  const sort = pick("sort") || "recent";

  const user = await getCurrentUser();
  const plugins = listPlugins({ q: q || undefined, type, tag: tag || undefined, teamId: team ? Number(team) : undefined, sort });
  const total = listPlugins({ status: "approved" }).length;
  const tags = allTags();
  const teams = listTeams().map((t) => ({ id: t.id, name: t.name }));

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 px-6 py-10 text-white sm:px-10">
        <h1 className="text-2xl font-bold sm:text-3xl">Agent Plugin Marketplace</h1>
        <p className="mt-2 max-w-2xl text-indigo-100">
          Discover skills, MCP servers, plugins and documentation for your agents — reviewed, scanned and shared across
          Acme teams.
        </p>
        <div className="mt-5 flex flex-wrap gap-6 text-sm text-indigo-100">
          <span><strong className="text-white">{total}</strong> catalog items</span>
          <span><strong className="text-white">{teams.length}</strong> teams</span>
          <span><strong className="text-white">{tags.length}</strong> tags</span>
        </div>
      </section>

      <SearchFilters tags={tags} teams={teams} counts={{ total, filtered: plugins.length }} />

      {plugins.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <PackageSearch className="h-10 w-10 text-slate-300" />
          <p className="mt-3 font-medium text-slate-700">Nothing matches those filters</p>
          <p className="mt-1 text-sm text-slate-500">Try a different search term or clear the filters.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plugins.map((p) => (
            <PluginCard key={p.id} p={p} />
          ))}
        </div>
      )}
      {!user && (
        <p className="text-center text-sm text-slate-500">
          <a href="/login" className="font-medium text-indigo-600 hover:underline">Log in</a> to submit plugins, join teams and download.
        </p>
      )}
    </div>
  );
}
