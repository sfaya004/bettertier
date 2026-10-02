"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { inputClass } from "./ui";

interface Result {
  slug: string;
  name: string;
  categoryLabel: string;
  planCount: number;
}

/**
 * Accessible search-as-you-type. Results render as plain links (no custom
 * combobox widgetry) so screen readers and keyboard users get ordinary behaviour.
 */
export function SearchBox({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Result[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      setError(null);
      return;
    }
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (!res.ok) throw new Error("bad response");
        const data = (await res.json()) as { results: Result[] };
        setResults(data.results);
        setError(null);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError("We couldn't search right now. Please try again in a moment.");
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (results && results.length > 0) router.push(`/check/${results[0].slug}`);
        }}
      >
        <label htmlFor={id} className="block font-semibold text-[1.1rem]">
          Type the name of the subscription
        </label>
        <p className="mt-1 text-[var(--color-ink-soft)]">For example: Netflix, Spotify, Microsoft 365, ChatGPT, Xbox</p>
        <input
          id={id}
          type="search"
          className={`${inputClass} mt-3 text-[1.2rem]`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          aria-describedby={`${id}-status`}
          placeholder="Start typing…"
          enterKeyHint="search"
          autoFocus
        />
      </form>
      <p id={`${id}-status`} className="sr-only" aria-live="polite">
        {loading ? "Searching" : results ? `${results.length} ${results.length === 1 ? "match" : "matches"} found` : ""}
      </p>
      {error ? (
        <p role="alert" className="mt-3 font-semibold text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
      {results && results.length > 0 ? (
        <ul className="mt-4 grid gap-3" aria-label="Matching subscriptions">
          {results.map((r) => (
            <li key={r.slug}>
              <Link
                href={`/check/${r.slug}`}
                className="block rounded-[var(--radius-md)] border-2 border-[var(--color-line-strong)] bg-white px-5 py-4 min-h-16 no-underline text-[var(--color-ink)] hover:border-[var(--color-brand)] hover:bg-[var(--color-brand-soft)]"
              >
                <span className="block text-[1.15rem] font-semibold">{r.name}</span>
                <span className="block text-[var(--color-ink-soft)]">
                  {r.categoryLabel} · {r.planCount} {r.planCount === 1 ? "plan" : "plans"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {results && results.length === 0 && !loading ? (
        <div className="mt-4 rounded-[var(--radius-md)] border-2 border-[var(--color-line)] bg-white p-5">
          <p className="font-bold">We couldn&apos;t find that subscription.</p>
          <p className="mt-1">
            Check the spelling, or <Link href="/plans">browse the full list</Link>. We add new subscriptions regularly.
          </p>
        </div>
      ) : null}
    </div>
  );
}
