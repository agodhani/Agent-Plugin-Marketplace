"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Tabs({
  tabs,
  initial,
}: {
  tabs: { id: string; label: ReactNode; content: ReactNode }[];
  initial?: string;
}) {
  return (
    <TabsPrimitive.Root defaultValue={initial ?? tabs[0]?.id}>
      <TabsPrimitive.List className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {tabs.map((t) => (
          <TabsPrimitive.Trigger
            key={t.id}
            value={t.id}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-slate-500 transition",
              "hover:border-slate-300 hover:text-slate-800 data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-700"
            )}
          >
            {t.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {tabs.map((t) => (
        <TabsPrimitive.Content key={t.id} value={t.id} className="pt-5 data-[state=inactive]:hidden">
          {t.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}
