"use client";

import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";

export function FaqAccordion({ items }: { items: { q: string; a: string }[] }) {
  return (
    <AccordionPrimitive.Root type="single" collapsible defaultValue="item-0" className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
      {items.map((item, i) => (
        <AccordionPrimitive.Item key={i} value={`item-${i}`}>
          <AccordionPrimitive.Trigger className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-800 transition hover:bg-slate-50 data-[state=open]:bg-slate-50 [&[data-state=open]>svg]:rotate-180">
            {item.q}
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200" />
          </AccordionPrimitive.Trigger>
          <AccordionPrimitive.Content className="overflow-hidden px-4 text-sm leading-relaxed text-slate-600 data-[state=closed]:animate-[accordion-up_0.2s_ease-out] data-[state=open]:animate-[accordion-down_0.2s_ease-out]">
            <div className="pb-4">{item.a}</div>
          </AccordionPrimitive.Content>
        </AccordionPrimitive.Item>
      ))}
    </AccordionPrimitive.Root>
  );
}
