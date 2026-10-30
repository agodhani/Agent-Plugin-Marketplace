import { Star } from "lucide-react";

export function StarRow({ avg, count, className = "" }: { avg: number; count: number; className?: string }) {
  if (count === 0) return <span className={`text-xs text-slate-400 ${className}`}>No reviews</span>;
  const rounded = Math.round(avg);
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} title={`${avg.toFixed(1)} from ${count} review${count === 1 ? "" : "s"}`}>
      <span className="flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} className={`h-3.5 w-3.5 ${i <= rounded ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
        ))}
      </span>
      <span className="text-xs font-medium text-slate-600">{avg.toFixed(1)}</span>
      <span className="text-xs text-slate-400">({count})</span>
    </span>
  );
}
