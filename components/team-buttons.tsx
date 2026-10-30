"use client";

import { useTransition } from "react";
import { joinTeamAction, leaveTeamAction } from "@/lib/actions";

export function JoinLeaveButton({ teamId, isMember, loggedIn }: { teamId: number; isMember: boolean; loggedIn: boolean }) {
  const [pending, start] = useTransition();
  if (!loggedIn) return null;
  return (
    <button
      disabled={pending}
      onClick={() =>
        start(async () => {
          if (isMember) await leaveTeamAction(teamId);
          else await joinTeamAction(teamId);
        })
      }
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
        isMember
          ? "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          : "bg-indigo-600 text-white hover:bg-indigo-700"
      }`}
    >
      {isMember ? "Leave" : "Join"}
    </button>
  );
}
