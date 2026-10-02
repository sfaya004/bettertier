"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { createSession, destroySession, getSessionUser, hashPassword, verifyPassword } from "@/lib/auth";
import { clientKey, rateLimit } from "@/lib/ratelimit";
import { logEvent } from "@/lib/events";

export interface FormState {
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Echoed back so the form can keep what the person typed after an error. */
  email?: string;
}

const credentials = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email address, like name@example.com."),
  password: z.string().min(10, "Please use at least 10 characters. A short sentence works well."),
});

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const limiter = rateLimit(await clientKey("signup"), 10, 15 * 60_000);
  if (!limiter.ok) return { error: "Too many attempts. Please wait a few minutes and try again." };
  const parsed = credentials.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { email: String(formData.get("email") ?? ""), fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  const { email, password } = parsed.data;
  const existing = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (existing) return { email, fieldErrors: { email: "There's already an account with this email. Try signing in instead." } };
  const [user] = await db.insert(schema.users).values({ email, passwordHash: await hashPassword(password) }).returning({ id: schema.users.id });
  await createSession(user.id);
  void logEvent("account_created");
  redirect("/my-subscriptions?welcome=1");
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const limiter = rateLimit(await clientKey("signin"), 10, 15 * 60_000);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!limiter.ok) return { email, error: "Too many attempts. Please wait a few minutes and try again." };
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");
  const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  const ok = user ? await verifyPassword(password, user.passwordHash) : await verifyPassword(password, "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid"); // constant-time-ish
  if (!user || !ok) return { email, error: "We couldn't sign you in. Check your email address and password and try again." };
  await createSession(user.id);
  await db.update(schema.users).set({ lastLoginAt: new Date().toISOString() }).where(eq(schema.users.id, user.id));
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : user.role === "admin" ? "/admin" : "/my-subscriptions");
}

export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/");
}

export async function deleteAccount(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user) redirect("/account/sign-in");
  if (String(formData.get("confirm")) !== "DELETE") redirect("/account?error=confirm");
  await db.delete(schema.users).where(eq(schema.users.id, user.id));
  await destroySession();
  redirect("/?deleted=1");
}

export async function deleteSavedSubscription(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user) redirect("/account/sign-in");
  const id = Number(formData.get("id"));
  if (Number.isInteger(id)) {
    const row = await db.query.userSubscriptions.findFirst({ where: eq(schema.userSubscriptions.id, id) });
    if (row && row.userId === user.id) await db.delete(schema.userSubscriptions).where(eq(schema.userSubscriptions.id, id));
  }
  redirect("/account");
}
