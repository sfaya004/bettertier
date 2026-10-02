"use client";

/**
 * Browser-side storage for guests. Nothing here is sent to the server unless
 * the person explicitly saves to an account.
 */
import type { Answers, BillingPeriod, FitStatus } from "@/lib/engine/types";

export interface SavedAnalysis {
  id: string;
  product: string;
  productName: string;
  currentPlan: string | null;
  currentPlanName: string;
  userPrice: number | null;
  userPeriod: BillingPeriod;
  answers: Answers;
  status: FitStatus;
  headline: string;
  currentMonthlyCost: number | null;
  recommendedPlan: string | null;
  recommendedPlanName: string | null;
  recommendedMonthlyCost: number | null;
  monthlyDifference: number | null;
  annualDifference: number | null;
  savedAt: string;
}

const KEY = "bt_analyses_v1";

function safeGet(): SavedAnalysis[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedAnalysis[]) : [];
  } catch {
    return [];
  }
}

function safeSet(items: SavedAnalysis[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* private mode or storage full – ignore */
  }
}

export function listAnalyses(): SavedAnalysis[] {
  return safeGet();
}

/** One entry per product – re-checking a subscription replaces the previous result. */
export function upsertAnalysis(item: Omit<SavedAnalysis, "id" | "savedAt">): SavedAnalysis {
  const items = safeGet().filter((x) => x.product !== item.product);
  const saved: SavedAnalysis = { ...item, id: `${item.product}-${Date.now()}`, savedAt: new Date().toISOString() };
  safeSet([saved, ...items]);
  return saved;
}

export function removeAnalysis(id: string) {
  safeSet(safeGet().filter((x) => x.id !== id));
}

export function clearAnalyses() {
  safeSet([]);
}

/* In-progress wizard state survives a page refresh. */
const PROGRESS_PREFIX = "bt_progress_";

export function loadProgress<T>(slug: string): T | null {
  try {
    const raw = sessionStorage.getItem(PROGRESS_PREFIX + slug);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveProgress<T>(slug: string, state: T) {
  try {
    sessionStorage.setItem(PROGRESS_PREFIX + slug, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function clearProgress(slug: string) {
  try {
    sessionStorage.removeItem(PROGRESS_PREFIX + slug);
  } catch {
    /* ignore */
  }
}

/** Fire-and-forget analytics ping (aggregate only). */
export function track(name: string, props: Record<string, string | number | boolean> = {}) {
  try {
    void fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, props }), keepalive: true });
  } catch {
    /* ignore */
  }
}
