import { Heart } from "lucide-react";
import { listPlugins } from "@/lib/queries";
import { FavoritesList } from "@/components/favorites";

export default async function FavoritesPage() {
  const items = listPlugins({ status: "approved" }).map((p) => ({
    id: p.id, slug: p.slug, name: p.name, type: p.type, summary: p.summary,
    rating_avg: p.rating_avg, rating_count: p.rating_count,
  }));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900"><Heart className="h-6 w-6 text-rose-500" /> Favorites</h1>
        <p className="mt-1 text-sm text-slate-500">Plugins you saved for later — stored in this browser.</p>
      </div>
      <FavoritesList items={items} />
    </div>
  );
}
