"use client";

import { useState, useTransition } from "react";
import { reviewAction } from "@/lib/actions";
import { CheckCircle2, XCircle } from "lucide-react";

export function ReviewPanel({ submissionId, isOwnSubmission = false }: { submissionId: number; isOwnSubmission?: boolean }) {
  if (isOwnSubmission) {
    return (
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-5">
        <h3 className="mb-3 font-semibold text-slate-900">Review decision</h3>
        <p className="text-sm text-slate-600">You can't review your own submission — another admin must approve or reject it.</p>
      </div>
    );
  }
  return <ReviewPanelInner submissionId={submissionId} />;
}

function ReviewPanelInner({ submissionId }: { submissionId: number }) {
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const act = (decision: "approve" | "reject") =>
    start(async () => {
      const res = await reviewAction(submissionId, decision, notes);
      if (res?.error) setError(res.error);
    });

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-5">
      <h3 className="mb-3 font-semibold text-slate-900">Review decision</h3>
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        placeholder="Review notes (visible to the submitter)…"
        className="mb-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
      />
      <div className="flex gap-3">
        <button
          onClick={() => act("approve")}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          <CheckCircle2 className="h-4 w-4" /> Approve
        </button>
        <button
          onClick={() => act("reject")}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          <XCircle className="h-4 w-4" /> Reject
        </button>
      </div>
    </div>
  );
}
