import type { ReactNode } from "react";

/** Readable long-form text: comfortable measure, spaced headings and lists. */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="[&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-2xl [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-xl [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mt-1 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-6">
      {children}
    </div>
  );
}

export function DraftNotice({ what }: { what: string }) {
  return (
    <p className="mb-6 rounded-[var(--radius-md)] border-2 border-[var(--color-warn)] bg-[var(--color-warn-soft)] p-4 font-semibold">
      Draft: this {what} was prepared as a starting point and has not yet been reviewed by a lawyer. Have it reviewed before relying on it.
    </p>
  );
}
