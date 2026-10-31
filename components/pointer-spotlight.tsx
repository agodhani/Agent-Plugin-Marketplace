"use client";

import { useEffect } from "react";

/**
 * One global pointermove listener (rAF-throttled) that tracks the cursor inside
 * any `.spotlight` element by setting --mx / --my on it. The CSS draws the
 * radial highlight in a pointer-events-none pseudo-element.
 */
export function PointerSpotlight() {
  useEffect(() => {
    let raf = 0;
    let last: PointerEvent | null = null;

    const apply = () => {
      raf = 0;
      if (!last) return;
      const el = (last.target as Element | null)?.closest?.(".spotlight");
      if (!(el instanceof HTMLElement)) return;
      const rect = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${last.clientX - rect.left}px`);
      el.style.setProperty("--my", `${last.clientY - rect.top}px`);
    };

    const onMove = (e: PointerEvent) => {
      last = e;
      if (!raf) raf = requestAnimationFrame(apply);
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}
