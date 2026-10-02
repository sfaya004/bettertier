import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui";
import { CheckFlow } from "@/components/CheckFlow";
import { getProductDef } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductDef(slug);
  if (!product) return { title: "Subscription not found" };
  return {
    title: `Is ${product.name} ${product.plans.length > 1 ? "the right plan for you" : "worth it for you"}?`,
    description: `Answer a few simple questions and find out whether your ${product.name} plan fits what you actually use.`,
    alternates: { canonical: `/check/${slug}` },
    robots: { index: false, follow: true },
  };
}

export default async function CheckProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductDef(slug);
  if (!product) notFound();
  return (
    <Container narrow>
      <CheckFlow product={product} />
    </Container>
  );
}
