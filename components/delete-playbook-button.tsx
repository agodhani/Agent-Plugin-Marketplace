"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deletePlaybookAction } from "@/lib/actions";

export function DeletePlaybookButton({ playbookId }: { playbookId: number }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (window.confirm("Delete this playbook? This cannot be undone.")) {
          start(async () => { await deletePlaybookAction(playbookId); });
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
    >
      <Trash2 className="h-4 w-4" /> Delete
    </button>
  );
}
