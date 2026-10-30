import Link from "next/link";
import { ArrowRight, Clock, ListChecks, Star, TrendingUp } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { allTags, listPlaybooks, listPlugins, listTeams } from "@/lib/queries";
import { PluginCard } from "@/components/plugin-card";
import { FeaturedCard } from "@/components/featured-card";
import { SearchFilters } from "@/components/search-filters";
import { PackageSearch } from "lucide-react";

function Shelf({ icon: Icon, title, href, children }: { icon: React.ElementType; title: string; href?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          <Icon className="h-4 w-4" /> {title}
        </h2>
        {href && <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline">View all <ArrowRight className="h-3.5 w-3.5" /></Link>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  );
}

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const pick = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const q = pick("q");
  const type = pick("type") || "all";
  const tag = pick("tag");
  const team = pick("team");
  const sort = pick("sort") || "recent";
  const filtering = !!(q || (type && type !== "all") || tag || team);

  const user = await getCurrentUser();
  const all = listPlugins({ status: "approved" });
  const plugins = filtering ? listPlugins({ q: q || undefined, type, tag: tag || undefined, teamId: team ? Number(team) : undefined, sort }) : all;
  const tags = allTags();
  const teams = listTeams().map((t) => ({ id: t.id, name: t.name }));
  const playbooks = listPlaybooks();

  const byDownloads = [...all].sort((a, b) => b.downloads - a.downloads);
  const featured = byDownloads[0];
  const trending = byDownloads.slice(1, 5);
  const recent = [...all].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 4);
  const topRated = [...all].filter((p) => p.rating_count > 0).sort((a, b) => b.rating_avg - a.rating_avg || b.rating_count - a.rating_count).slice(0, 4);

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-2xl border border-indigo-400/20 bg-gradient-to-br from-indigo-700 via-violet-700 to-fuchsia-700 px-6 py-12 text-white shadow-lg shadow-indigo-900/20 sm:px-10">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-56 w-56 rounded-full bg-fuchsia-400/20 blur-3xl" />
        <h1 className="relative text-3xl font-extrabold tracking-tight sm:text-4xl">Agent Plugin Marketplace</h1>
        <p className="mt-2 max-w-2xl text-indigo-100">
          Discover skills, MCP servers, plugins and documentation for your agents — reviewed, scanned and shared across
          Acme teams.
        </p>
        <div className="mt-5 flex flex-wrap gap-6 text-sm text-indigo-100">
          <span><strong className="text-white">{all.length}</strong> catalog items</span>
          <span><strong className="text-white">{teams.length}</strong> teams</span>
          <span><strong className="text-white">{tags.length}</strong> tags</span>
          <a href="/playbooks" className="underline-offset-2 hover:underline"><strong className="text-white">{playbooks.length}</strong> playbooks</a>
        </div>
      </section>

      <SearchFilters tags={tags} teams={teams} counts={{ total: all.length, filtered: plugins.length }} />

      {filtering ? (
        plugins.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
            <PackageSearch className="h-10 w-10 text-slate-300" />
            <p className="mt-3 font-medium text-slate-700">Nothing matches those filters</p>
            <p className="mt-1 text-sm text-slate-500">Try a different search term or clear the filters.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plugins.map((p) => <PluginCard key={p.id} p={p} />)}
          </div>
        )
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
            {featured && <FeaturedCard p={featured} />}
            <Shelf icon={TrendingUp} title="Trending now" href="/?sort=downloads">
              {trending.map((p) => <PluginCard key={p.id} p={p} />)}
            </Shelf>
          </div>
          <Shelf icon={Clock} title="Recently updated">
            {recent.map((p) => <PluginCard key={p.id} p={p} />)}
          </Shelf>
          <Shelf icon={Star} title="Top rated">
            {topRated.map((p) => <PluginCard key={p.id} p={p} />)}
          </Shelf>
          <Shelf icon={ListChecks} title="Playbooks" href="/playbooks">
            {playbooks.slice(0, 4).map((pb) => (
              <Link key={pb.id} href={`/playbooks/${pb.slug}`} className="group rounded-xl border border-fuchsia-200 bg-fuchsia-50/60 p-4 transition hover:border-fuchsia-400 hover:shadow-md">
                <div className="font-semibold text-slate-900 group-hover:text-fuchsia-700">{pb.name}</div>
                <p className="mt-1 line-clamp-2 text-sm text-slate-600">{pb.description}</p>
                <p className="mt-3 font-mono text-[11px] text-fuchsia-700/80">amp playbook install {pb.slug}</p>
              </Link>
            ))}
          </Shelf>
        </>
      )}
      {!user && (
        <p className="text-center text-sm text-slate-500">
          <a href="/login" className="font-medium text-indigo-600 hover:underline">Log in</a> to submit plugins, join teams and download.
        </p>
      )}
    </div>
  );
}
