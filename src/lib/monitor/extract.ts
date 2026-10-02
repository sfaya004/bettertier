/** Pure helpers for turning a pricing page into comparable facts. Unit-tested. */
import { createHash } from "node:crypto";

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

export interface FoundPrice {
  amount: number;
  raw: string;
  context: string;
}

/** Find dollar amounts on a page with a little surrounding text for evidence. */
export function extractPrices(text: string, currencySymbol = "$"): FoundPrice[] {
  const sym = currencySymbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${sym}\\s?(\\d{1,4}(?:,\\d{3})?(?:\\.\\d{2})?)`, "g");
  const out: FoundPrice[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const amount = Number(m[1].replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount <= 0 || amount > 5000) continue;
    const start = Math.max(0, m.index - 60);
    const end = Math.min(text.length, m.index + m[0].length + 60);
    const context = text.slice(start, end).trim();
    const key = `${amount}|${context.slice(0, 40)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ amount, raw: m[0], context });
  }
  return out;
}

export function contentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 32);
}

/** Does a known price appear on the page (allowing "$8.99" and "$8.99/mo" and "8.99")? */
export function priceAppears(found: FoundPrice[], amount: number): boolean {
  return found.some((f) => Math.abs(f.amount - amount) < 0.005);
}

export function summarizeDiff(prev: FoundPrice[] | null, next: FoundPrice[]): { added: number[]; removed: number[] } {
  const prevSet = new Set((prev ?? []).map((p) => p.amount));
  const nextSet = new Set(next.map((p) => p.amount));
  const added = prev ? [...nextSet].filter((a) => !prevSet.has(a)) : [];
  const removed = prev ? [...prevSet].filter((a) => !nextSet.has(a)) : [];
  return { added, removed };
}
