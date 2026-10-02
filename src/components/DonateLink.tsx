"use client";

import { LinkButton } from "./ui";
import { track } from "@/lib/store";

/** Outbound donation link with an aggregate click count (no personal data). */
export function DonateLink({ href, label, primary = false }: { href: string; label: string; primary?: boolean }) {
  return (
    <LinkButton href={href} target="_blank" rel="noopener noreferrer" variant={primary ? "primary" : "secondary"} onClick={() => track("donate_clicked", { page: "support" })}>
      {label}
    </LinkButton>
  );
}
