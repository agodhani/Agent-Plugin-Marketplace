"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { upsertReviewAction } from "@/lib/actions";

export function ReviewForm({ pluginId, initial }: { pluginId: number; initial?: { rating: number; body: string } }) {
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState(initial?.body ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const active = hover || rating;

  return (
    <form
      className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await upsertReviewAction(pluginId, rating, body);
          setMsg(res.error ?? "Review saved.");
          if (res.error) toast.error(res.error);
          else toast.success("Review saved");
        });
      }}
    >
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            aria-label={`Rate ${i} star${i > 1 ? "s" : ""}`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(i)}
            className="p-0.5"
          >
            <Star className={`h-6 w-6 transition ${i <= active ? "fill-amber-400 text-amber-400" : "text-slate-300 hover:text-amber-300"}`} />
          </button>
        ))}
        <span className="ml-2 text-xs text-slate-500">{rating ? `${rating}/5` : "Tap to rate"}</span>
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        placeholder="What worked, what didn't? (optional)"
        className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
      />
      <div className="mt-3 flex items-center gap-3">
        <button
          disabled={pending || rating === 0}
          className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {pending ? "Saving…" : initial ? "Update review" : "Post review"}
        </button>
        {msg && <span className="text-xs text-slate-500">{msg}</span>}
      </div>
    </form>
  );
}
