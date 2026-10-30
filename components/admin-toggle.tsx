"use client";

import { useTransition } from "react";
import { toggleAdminAction } from "@/lib/actions";

export function AdminToggle({ isAdmin }: { isAdmin: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(async () => { await toggleAdminAction(); })}
      disabled={pending}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition disabled:opacity-50 ${
        isAdmin ? "bg-amber-500" : "bg-slate-300"
      }`}
      role="switch"
      aria-checked={isAdmin}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${isAdmin ? "translate-x-6" : "translate-x-1"}`}
      />
    </button>
  );
}
