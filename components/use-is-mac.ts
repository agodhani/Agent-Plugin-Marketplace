"use client";

import { useEffect, useState } from "react";

/** SSR defaults to macOS (⌘); resolved to the real platform after mount. */
export function useIsMac(): boolean {
  const [isMac, setIsMac] = useState(true);
  useEffect(() => {
    setIsMac(/mac/i.test(navigator.platform ?? "") || /mac/i.test(navigator.userAgent));
  }, []);
  return isMac;
}
