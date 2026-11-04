import Link from "next/link";
import { ArrowRight, Clock, ListChecks, PackageSearch, Star, TrendingUp } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { allTags, getPlaybookBySlug, listPlaybooks, listPlugins, catalogStats, teamNames, countPlugins, PAGE_SIZE } from "@/lib/queries";
import { PluginCard } from "@/components/plugin-card";
import { Pagination } from "@/components/pagination";
import { FeaturedCard } from "@/components/featured-card";
import { SearchFilters } from "@/components/search-filters";
import { Hero } from "@/components/hero";
import { ActivityMarquee } from "@/components/activity-marquee";

function Shelf({
  eyebrow,
  title,
  subtitle,
  href,
  reveal = false,
  gridClass = "sm:grid-cols-2 xl:grid-cols-4",
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  href?: string;
  reveal?: boolean;
  gridClass?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={reveal ? "reveal" : undefined}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-500">{eyebrow}</p>
          <h2 className="mt-0.5 text-lg font-bold tracking-tight text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {href && (
          <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 transition hover:gap-1.5 hover:underline">
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      <div className={`grid gap-4 ${gridClass}`}>{children}</div>
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
  const verified = pick("verified") === "1";
  const filtering = !!(q || (type && type !== "all") || tag || team || verified);

  const rawPage = Number(pick("page"));
  const user = await getCurrentUser();
  const stats = catalogStats();
  const filterOpts = { q: q || undefined, type, tag: tag || undefined, teamId: team ? Number(team) : undefined, sort, verified: verified || undefined };
  const total = filtering ? countPlugins(filterOpts) : 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = !filtering ? 1 : Number.isInteger(rawPage) && rawPage >= 1 ? Math.min(rawPage, lastPage) : 1;
  const plugins = filtering ? listPlugins({ ...filterOpts, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }) : [];
  const tags = allTags();
  const teams = teamNames();
  const playbooks = listPlaybooks();

  const byDownloads = listPlugins({ status: "approved", sort: "downloads", limit: 5 });
  const featured = byDownloads[0];
  const trending = byDownloads.slice(1, 5);
  const recent = listPlugins({ status: "approved", limit: 4 });
  const topRated = listPlugins({ status: "approved", rated: true, sort: "rating", limit: 4 });
  const totalInstalls = stats.downloads;

  const topBook = [...playbooks].sort((a, b) => b.item_count - a.item_count)[0];
  const topBookDetail = topBook ? getPlaybookBySlug(topBook.slug) : null;

  return (
    <div className="space-y-10">
      <Hero
        stats={{
          items: stats.count,
          installs: totalInstalls,
          teams: teams.length,
          playbooks: playbooks.length,
        }}
        terminal={
          topBook && topBookDetail
            ? {
                playbookSlug: topBook.slug,
                items: topBookDetail.items.slice(0, 4).map((it) => ({
                  slug: it.slug,
                  name: it.name,
                  version: it.current_version,
                  risk: it.risk_level,
                })),
              }
            : undefined
        }
        floats={topRated.slice(0, 2).map((p) => ({
          name: p.name,
          type: p.type,
          rating_avg: p.rating_avg,
          rating_count: p.rating_count,
        }))}
      />

      <ActivityMarquee />

      <SearchFilters tags={tags} teams={teams} counts={{ total: stats.count, filtered: filtering ? total : stats.count }} />

      <div data-testid="catalog-results" className="space-y-10">
      {filtering ? (
        plugins.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
            <PackageSearch className="h-10 w-10 text-slate-300" />
            <p className="mt-3 font-medium text-slate-700">Nothing matches those filters</p>
            <p className="mt-1 text-sm text-slate-500">Try a different search term or clear the filters.</p>
          </div>
        ) : (
          <div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {plugins.map((p, i) => <PluginCard key={p.id} p={p} i={i % 6} />)}
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} params={{ q, type: type !== "all" ? type : "", tag, team, sort: sort !== "recent" ? sort : "", verified: verified ? "1" : "" }} />
          </div>
        )
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
            {featured && <FeaturedCard p={featured} />}
            <Shelf eyebrow="Marketplace" title="Trending now" subtitle="Most-installed this month" href="/?sort=downloads" gridClass="sm:grid-cols-2">
              {trending.map((p, i) => <PluginCard key={p.id} p={p} i={i} />)}
            </Shelf>
          </div>
          <Shelf eyebrow="Fresh code" title="Recently updated" subtitle="New versions and fixes" reveal>
            {recent.map((p, i) => <PluginCard key={p.id} p={p} i={i} />)}
          </Shelf>
          <Shelf eyebrow="Loved by teams" title="Top rated" subtitle="Highest average review scores" reveal>
            {topRated.map((p, i) => <PluginCard key={p.id} p={p} i={i} />)}
          </Shelf>
          <Shelf eyebrow="Bundle & go" title="Playbooks" subtitle="Curated installs for agent setups" href="/playbooks" reveal>
            {playbooks.slice(0, 4).map((pb) => (
              <Link key={pb.id} href={`/playbooks/${pb.slug}`} className="group rounded-2xl bg-white p-4 ring-1 ring-fuchsia-200/80 transition duration-200 hover:-translate-y-0.5 hover:ring-fuchsia-300 hover:shadow-lg hover:shadow-fuchsia-200/50">
                <div className="font-semibold text-slate-900 group-hover:text-fuchsia-700">{pb.name}</div>
                <p className="mt-1 line-clamp-2 text-sm text-slate-600">{pb.description}</p>
                <p className="mt-3 font-mono text-[11px] text-fuchsia-700/80">agenthub playbook install {pb.slug}</p>
              </Link>
            ))}
          </Shelf>
        </>
      )}
      </div>
      {!user && (
        <p className="text-center text-sm text-slate-500">
          <a href="/login" className="font-medium text-indigo-600 hover:underline">Log in</a> to submit plugins, join teams and download.
        </p>
      )}
    </div>
  );
}
