"use client";

import { useState, useTransition } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CopyButton } from "./copy-button";
import { createTokenAction, revokeTokenAction } from "@/lib/actions";
import { fmtDate } from "@/lib/utils";

export interface TokenRow {
  id: number;
  name: string;
  prefix: string;
  created_at: string;
  expires_at: string;
  last_used_at: string | null;
}

export function TokenManager({ tokens }: { tokens: TokenRow[] }) {
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const create = () =>
    start(async () => {
      const res = await createTokenAction(name);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setFresh(res.token!);
      setName("");
      toast.success("Token created");
    });

  const revoke = (id: number) =>
    start(async () => {
      const res = await revokeTokenAction(id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Token revoked");
    });

  return (
    <div id="tokens" className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="mb-1 flex items-center gap-1.5 font-semibold text-slate-900">
        <KeyRound className="h-4 w-4 text-slate-400" /> Access tokens
      </h2>
      <p className="mb-4 text-xs text-slate-500">
        Use a token with the AgentHub CLI or API. Tokens can read and download catalog items; they can't change anything.
      </p>
      {fresh && (
        <div data-testid="new-token" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <code className="truncate font-mono text-xs text-emerald-900">{fresh}</code>
            <CopyButton text={fresh} />
          </div>
          <p className="mt-1 text-[11px] text-emerald-700">Copy it now — you won't see it again.</p>
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Token name (e.g. laptop CLI)"
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
        <Button size="sm" disabled={pending || !name.trim()} onClick={create}>
          Create token
        </Button>
      </div>
      {tokens.length > 0 && (
        <ul className="mt-4 divide-y divide-slate-100">
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                <span className="font-medium text-slate-800">{t.name}</span>{" "}
                <code className="font-mono text-xs text-slate-500">{t.prefix}…</code>
                <p className="text-xs text-slate-400">
                  created {fmtDate(t.created_at)} · last used {t.last_used_at ? fmtDate(t.last_used_at) : "never"} · expires {fmtDate(t.expires_at)}
                </p>
              </div>
              <Button variant="outline" size="sm" disabled={pending} onClick={() => revoke(t.id)}>
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
