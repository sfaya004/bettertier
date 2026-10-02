import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { listPublishedProducts, getProductDef } from "@/lib/catalog";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await listPublishedProducts();
  const staticPages: MetadataRoute.Sitemap = ["", "/check", "/plans", "/help", "/about", "/support", "/privacy", "/terms", "/bot"].map((p) => ({
    url: `${SITE_URL}${p}`,
    changeFrequency: p === "" || p === "/plans" ? "weekly" : "monthly",
    priority: p === "" ? 1 : p === "/check" || p === "/plans" ? 0.9 : 0.4,
  }));
  const productPages: MetadataRoute.Sitemap = [];
  for (const p of products) {
    productPages.push({ url: `${SITE_URL}/plans/${p.slug}`, lastModified: p.lastVerifiedAt ? new Date(p.lastVerifiedAt) : undefined, changeFrequency: "weekly", priority: 0.8 });
    const def = await getProductDef(p.slug);
    if (!def) continue;
    const active = def.plans.filter((x) => x.status === "active");
    for (let i = 0; i < active.length - 1; i++) {
      productPages.push({ url: `${SITE_URL}/plans/${p.slug}/${active[i].slug}-vs-${active[i + 1].slug}`, changeFrequency: "weekly", priority: 0.6 });
    }
  }
  return [...staticPages, ...productPages];
}
