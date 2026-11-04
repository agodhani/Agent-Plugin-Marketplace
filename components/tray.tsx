"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, Package, Plus, Save, Terminal, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { CopyButton } from "./copy-button";
import { createPlaybookFromTrayAction } from "@/lib/actions";

export interface TrayItem {
  id: number;
  slug: string;
  name: string;
  type: string;
}

interface TrayCtx {
  items: TrayItem[];
  add: (item: TrayItem) => void;
  remove: (id: number) => void;
  clear: () => void;
  has: (id: number) => boolean;
  open: boolean;
  setOpen: (v: boolean) => void;
}

const Ctx = createContext<TrayCtx | null>(null);
const STORAGE_KEY = "agenthub:tray";

export function TrayProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<TrayItem[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch { /* ignore */ }
  }, [items]);

  const value: TrayCtx = {
    items,
    open,
    setOpen,
    has: (id) => items.some((i) => i.id === id),
    add: (item) => setItems((cur) => (cur.some((i) => i.id === item.id) ? cur : [...cur, item])),
    remove: (id) => setItems((cur) => cur.filter((i) => i.id !== id)),
    clear: () => setItems([]),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTray() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTray must be used inside TrayProvider");
  return ctx;
}

export function AddToTrayButton({ item, className = "" }: { item: TrayItem; className?: string }) {
  const { add, remove, has, setOpen } = useTray();
  const inTray = has(item.id);
  return (
    <button
      type="button"
      aria-label={inTray ? `Remove ${item.name} from tray` : `Add ${item.name} to tray`}
      title={inTray ? "In install tray — click to remove" : "Add to install tray"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (inTray) {
          remove(item.id);
        } else {
          add(item);
          toast.success(`Added ${item.name} to install tray`, {
            action: { label: "Open tray", onClick: () => setOpen(true) },
          });
        }
      }}
      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition ${
        inTray
          ? "border-green-300 bg-green-50 text-green-700"
          : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-700"
      } ${className}`}
    >
      {inTray ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
      {inTray ? "In tray" : "Add"}
    </button>
  );
}

export type Target = "cli" | "claude" | "cursor" | "download";

const TARGETS: { id: Target; label: string }[] = [
  { id: "cli", label: "AgentHub CLI" },
  { id: "claude", label: "Claude Code" },
  { id: "cursor", label: "Cursor" },
  { id: "download", label: "Raw zips" },
];

export function buildInstall(target: Target, items: TrayItem[], origin: string): string {
  const slugs = items.map((i) => i.slug).join(" ");
  if (target === "cli") return `agenthub install ${slugs}`;
  if (target === "claude" || target === "cursor") return `agenthub install ${slugs} --agent ${target}`;
  return items.map((i) => `curl -fsSL -H "Authorization: Bearer $AGENTHUB_TOKEN" "${origin}/api/plugins/${i.id}/download" -o ${i.slug}.zip`).join("\n");
}

export function InstallTray({ isLoggedIn }: { isLoggedIn: boolean }) {
  const { items, remove, clear, open, setOpen } = useTray();
  const [target, setTarget] = useState<Target>("cli");
  const [pbName, setPbName] = useState("");
  const [pbMsg, setPbMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  if (items.length === 0 && !open) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const command = buildInstall(target, items, origin);

  return (
    <>
      {/* floating pill — key remount replays the bump animation on every add */}
      {!open && items.length > 0 && (
        <button
          key={items.length}
          onClick={() => setOpen(true)}
          className="bump fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-700"
        >
          <Package className="h-4 w-4" />
          Install tray
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white/20 px-1.5 text-xs">{items.length}</span>
        </button>
      )}

      {/* drawer */}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30" onClick={() => setOpen(false)}>
          <div
            className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="flex items-center gap-2 font-semibold text-slate-900">
                <Package className="h-4 w-4 text-indigo-600" /> Install tray
              </h2>
              <button onClick={() => setOpen(false)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close tray">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {items.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-500">
                  Tray is empty. Hit <strong>Add</strong> on any catalog card to collect plugins, then generate one install command.
                </p>
              ) : (
                <ul className="space-y-2">
                  {items.map((i) => (
                    <li key={i.id} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-800">{i.name}</span>
                        <span className="block font-mono text-xs text-slate-400">{i.slug} · {i.type}</span>
                      </span>
                      <button onClick={() => remove(i.id)} className="text-slate-300 hover:text-red-500" aria-label={`Remove ${i.name}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {items.length > 0 && (
                <>
                  <div className="mt-5">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      <Terminal className="h-3.5 w-3.5" /> Install target
                    </p>
                    <div className="flex rounded-lg border border-slate-200 p-1">
                      {TARGETS.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setTarget(t.id)}
                          className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${
                            target === t.id ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3 overflow-hidden rounded-lg bg-slate-900">
                    <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-1.5">
                      <span className="truncate font-mono text-[11px] text-slate-400">terminal</span>
                      <CopyButton text={command} className="border-0 !bg-transparent !px-1.5 !py-0.5 !text-slate-300 hover:!bg-white/10" />
                    </div>
                    <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-[11px] leading-relaxed text-slate-100">{command}</pre>
                  </div>

                  {isLoggedIn && (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        <Save className="h-3.5 w-3.5" /> Save as playbook
                      </p>
                      <div className="flex gap-2">
                        <input
                          value={pbName}
                          onChange={(e) => setPbName(e.target.value)}
                          placeholder="My agent toolkit"
                          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400"
                        />
                        <button
                          disabled={saving || pbName.trim().length < 3}
                          onClick={async () => {
                            setSaving(true);
                            setPbMsg(null);
                            const res = await createPlaybookFromTrayAction(pbName.trim(), items.map((i) => i.id));
                            setSaving(false);
                            if (res.slug) {
                              clear();
                              setOpen(false);
                              toast.success("Playbook saved");
                              router.push(`/playbooks/${res.slug}`);
                            } else {
                              setPbMsg(res.error ?? "Failed to save playbook.");
                            }
                          }}
                          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {saving ? "…" : "Save"}
                        </button>
                      </div>
                      {pbMsg && <p className="mt-1.5 text-xs text-red-600">{pbMsg}</p>}
                    </div>
                  )}
                  <button onClick={clear} className="mt-4 text-xs text-slate-400 hover:text-slate-600">
                    Clear tray
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
