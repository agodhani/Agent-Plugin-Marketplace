"use client";

import { Search } from "lucide-react";
import { useCommandPalette } from "./command-palette";

export function PaletteButton({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  const { open } = useCommandPalette();
  return (
    <button
      type="button"
      onClick={open}
      className={`inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-lg shadow-indigo-950/40 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl ${className}`}
    >
      <Search className="h-4 w-4 text-slate-400" />
      {children ?? "Search the catalog"}
    </button>
  );
}
