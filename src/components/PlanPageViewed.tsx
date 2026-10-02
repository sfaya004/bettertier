"use client";

import { useEffect } from "react";
import { track } from "@/lib/store";

/** Records an aggregate "plan page viewed" event. No personal data. */
export function PlanPageViewed({ product }: { product: string }) {
  useEffect(() => {
    track("plan_page_viewed", { product });
  }, [product]);
  return null;
}
