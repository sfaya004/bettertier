"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Sends one anonymous "a page was viewed" ping per page. It carries only the path
 * and the referring site – no cookies, no identifiers, nothing stored in the browser.
 */
export function PageViewBeacon() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || last.current === pathname) return;
    last.current = pathname;
    if (pathname.startsWith("/admin") || pathname.startsWith("/account")) return;
    const referrer = typeof document !== "undefined" && document.referrer ? document.referrer : null;
    const body = JSON.stringify({ path: pathname, referrer });
    try {
      fetch("/api/pageview", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    } catch {
      /* ignore – analytics must never break the page */
    }
  }, [pathname]);

  return null;
}
