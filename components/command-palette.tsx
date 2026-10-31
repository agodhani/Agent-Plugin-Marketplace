"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import {
  ArrowRight,
  GitCompareArrows,
  Heart,
  Home,
  Keyboard,
  ListChecks,
  Search,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";
import { RiskBadge, TypeBadge, TypeIcon } from "./badges";

interface SearchPlugin {
  id: number;
  slug: string;
  name: string;
  type: string;
  summary: string;
  tags: string[];
  risk_level: string;
  rating_avg: number;
}
interface SearchPlaybook {
  slug: string;
  name: string;
  description: string;
}
interface SearchIndex {
  plugins: SearchPlugin[];
  playbooks: SearchPlaybook[];
}

const Ctx = createContext<{ open: () => void }>({ open: () => {} });
export const useCommandPalette = () => useContext(Ctx);

const PAGES = [
  { href: "/", label: "Browse", hint: "catalog home", icon: Home },
  { href: "/playbooks", label: "Playbooks", hint: "bundled installs", icon: ListChecks },
  { href: "/submit", label: "Submit", hint: "publish a plugin", icon: Upload },
  { href: "/teams", label: "Teams", hint: "usage & membership", icon: Users },
  { href: "/favorites", label: "Favorites", hint: "saved items", icon: Heart },
  { href: "/compare", label: "Compare", hint: "side-by-side", icon: GitCompareArrows },
];

export function CommandPaletteProvider({ children, isAdmin }: { children: ReactNode; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState<SearchIndex | null>(null);
  const router = useRouter();

  // Cmd/Ctrl+K anywhere; "/" when not typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const t = e.target as HTMLElement | null;
        const tag = t?.tagName;
        const editable =
          tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t?.isContentEditable;
        if (!editable) {
          e.preventDefault();
          setOpen(true);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // lazy-fetch the search index once, then cache for the session
  useEffect(() => {
    if (!open || index) return;
    let cancelled = false;
    fetch("/api/search-index")
      .then((r) => r.json())
      .then((d: SearchIndex) => {
        if (!cancelled) setIndex(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, index]);

  const ctx = useMemo(() => ({ open: () => setOpen(true) }), []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const pages = isAdmin ? [...PAGES, { href: "/admin", label: "Review queue", hint: "admin", icon: ShieldCheck }] : PAGES;

  const itemCls =
    "group relative flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-700 " +
    "before:absolute before:bottom-1.5 before:left-0 before:top-1.5 before:w-0.5 before:rounded-full before:bg-transparent " +
    "aria-selected:bg-indigo-50 aria-selected:text-indigo-900 aria-selected:before:bg-indigo-500";

  return (
    <Ctx.Provider value={ctx}>
      {children}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="palette-overlay fixed inset-0 z-[60] bg-slate-950/40 backdrop-blur-sm" />
          <Dialog.Content className="palette-panel fixed left-1/2 top-[16%] z-[61] w-[min(92vw,36rem)] -translate-x-1/2 overflow-hidden rounded-2xl bg-white shadow-2xl shadow-slate-900/30 ring-1 ring-slate-200">
            <Dialog.Title className="sr-only">Search AgentHub</Dialog.Title>
            <Dialog.Description className="sr-only">
              Search the catalog, playbooks and pages. Arrow keys to navigate, Enter to open.
            </Dialog.Description>
            <Command label="Search AgentHub" className="flex flex-col">
              <div className="flex items-center gap-3 border-b border-slate-200/80 px-4">
                <Search className="h-4 w-4 shrink-0 text-slate-400" />
                <Command.Input
                  autoFocus
                  placeholder="Search plugins, playbooks, pages…"
                  className="h-12 w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                />
              </div>
              <Command.List className="max-h-[min(24rem,55vh)] overflow-y-auto p-2">
                <Command.Empty className="px-3 py-8 text-center text-sm text-slate-400">
                  No results found.
                </Command.Empty>
                <Command.Group
                  heading="Pages"
                  className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-slate-400"
                >
                  {pages.map((pg) => (
                    <Command.Item
                      key={pg.href}
                      value={pg.label}
                      keywords={[pg.hint, "page"]}
                      onSelect={() => go(pg.href)}
                      className={itemCls}
                    >
                      <pg.icon className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="flex-1 font-medium">{pg.label}</span>
                      <span className="text-xs text-slate-400">{pg.hint}</span>
                      <span className="hidden text-xs font-medium text-indigo-400 group-aria-selected:inline">↵</span>
                    </Command.Item>
                  ))}
                </Command.Group>
                {index && index.plugins.length > 0 && (
                  <Command.Group
                    heading="Plugins"
                    className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-slate-400"
                  >
                    {index.plugins.map((p) => (
                      <Command.Item
                        key={p.slug}
                        value={`${p.name} ${p.slug}`}
                        keywords={[p.slug, p.type, ...p.tags]}
                        onSelect={() => go(`/plugins/${p.slug}`)}
                        className={itemCls}
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                          <TypeIcon type={p.type} className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{p.name}</span>
                          <span className="block truncate text-xs text-slate-500">{p.summary}</span>
                        </span>
                        <TypeBadge type={p.type} />
                        <RiskBadge level={p.risk_level} />
                        <span className="hidden shrink-0 text-xs font-medium text-indigo-400 group-aria-selected:inline">↵</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
                {index && index.playbooks.length > 0 && (
                  <Command.Group
                    heading="Playbooks"
                    className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-slate-400"
                  >
                    {index.playbooks.map((pb) => (
                      <Command.Item
                        key={pb.slug}
                        value={`${pb.name} ${pb.slug}`}
                        keywords={[pb.slug, "playbook"]}
                        onSelect={() => go(`/playbooks/${pb.slug}`)}
                        className={itemCls}
                      >
                        <ListChecks className="h-4 w-4 shrink-0 text-fuchsia-500" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{pb.name}</span>
                          <span className="block truncate text-xs text-slate-500">{pb.description}</span>
                        </span>
                        <span className="hidden shrink-0 text-xs font-medium text-indigo-400 group-aria-selected:inline">↵</span>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-300" />
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
              </Command.List>
              <div className="flex items-center gap-4 border-t border-slate-200/80 px-4 py-2.5 text-[11px] text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <Keyboard className="h-3 w-3" /> ↑↓ navigate
                </span>
                <span>↵ open</span>
                <span>esc close</span>
              </div>
            </Command>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Ctx.Provider>
  );
}
