"use client";

import { useTransition } from "react";
import { BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setPluginVerifiedAction } from "@/lib/actions";

export function VerifyControl({
  pluginId,
  verified,
  detail,
  blockReason,
}: {
  pluginId: number;
  verified: boolean;
  detail: string | null;
  blockReason: string | null;
}) {
  const [pending, start] = useTransition();
  const toggle = () =>
    start(async () => {
      const res = await setPluginVerifiedAction(pluginId, !verified);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(verified ? "Verification removed" : "Plugin verified");
    });
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
        <BadgeCheck className="h-4 w-4 text-slate-400" /> Verification
      </h3>
      <p className="text-sm font-medium text-slate-800">{verified ? detail : "Not verified yet."}</p>
      <p className="mt-1.5 text-xs text-slate-500">
        Verified plugins show a badge across the catalog: an admin vetted them and they're officially supported.
      </p>
      {blockReason ? (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-inset ring-slate-200">{blockReason}</p>
      ) : (
        <Button
          variant={verified ? "outline" : "default"}
          size="sm"
          className="mt-3"
          disabled={pending}
          onClick={toggle}
        >
          <BadgeCheck className="h-4 w-4" />
          {verified ? "Remove verification" : "Verify plugin"}
        </Button>
      )}
    </div>
  );
}
