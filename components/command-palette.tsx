"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import {
  ArrowRight,
  GitCompareArrows,
  Heart,
  Home,
  Keyboard,
  ListChecks,
  Search,
  ShieldCheck,
  Terminal,
  Upload,
  Users,
} from "lucide-react";
import { RiskBadge, TypeBadge, TypeIcon, VerifiedMark } from "./badges";

interface SearchPlugin {
  id: number;
  slug: string;
  name: string;
  type: string;
  summary: string;
  tags: string[];
  risk_level: string;
  rating_avg: number;
  verified: boolean;
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
  { href: "/cli", label: "CLI", hint: "install from your terminal", icon: Terminal },
];

const PaletteDialog = dynamic(() => import("./command-palette-dialog").then((m) => m.PaletteDialog), { ssr: false });
export const warmPalette = () => import("./command-palette-dialog");

export function CommandPaletteProvider({ children, isAdmin }: { children: ReactNode; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);

  // Cmd/Ctrl+K anywhere; "/" when not typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        setEverOpened(true);
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
          setEverOpened(true);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const ctx = useMemo(() => ({ open: () => { setOpen(true); setEverOpened(true); } }), []);

  return (
    <Ctx.Provider value={ctx}>
      {children}
      {everOpened && <PaletteDialog open={open} onOpenChange={setOpen} isAdmin={isAdmin} />}
    </Ctx.Provider>
  );
}
