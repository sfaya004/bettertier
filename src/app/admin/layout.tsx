import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/account/sign-in?next=/admin");
  if (user.role !== "admin") redirect("/account");
  return (
    <Container>
      <nav aria-label="Admin" className="mb-8 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-4 py-3">
        <ul className="flex flex-wrap gap-x-6 gap-y-2 font-semibold">
          <li><Link href="/admin">Overview</Link></li>
          <li><Link href="/admin/companies">Companies &amp; plans</Link></li>
          <li><Link href="/admin/changes">Changes to review</Link></li>
          <li><Link href="/admin/monitor">Price monitor</Link></li>
          <li><Link href="/admin/analytics">Analytics</Link></li>
          <li className="ml-auto text-[var(--color-ink-soft)] font-normal">{user.email}</li>
        </ul>
      </nav>
      {children}
    </Container>
  );
}
