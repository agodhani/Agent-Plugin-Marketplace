export function StarRow({ avg, count, className = "" }: { avg: number; count: number; className?: string }) {
  if (count === 0) return <span className={`text-xs text-slate-400 ${className}`}>No reviews</span>;
  const rounded = Math.round(avg);
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} title={`${avg.toFixed(1)} from ${count} review${count === 1 ? "" : "s"}`}>
      <span aria-hidden className="relative block h-3.5 w-[70px]">
        <span aria-hidden className="stars-outline absolute inset-0 block bg-slate-300" />
        <span aria-hidden className="stars-filled absolute inset-y-0 left-0 block bg-amber-400" style={{ width: `${rounded * 14}px` }} />
      </span>
      <span className="text-xs font-medium text-slate-600">{avg.toFixed(1)}</span>
      <span className="text-xs text-slate-400">({count})</span>
    </span>
  );
}
