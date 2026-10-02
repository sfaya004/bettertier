import "server-only";
import { cookies, headers } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq, lt } from "drizzle-orm";
import { db, schema } from "@/db";

export const SESSION_COOKIE = "bt_session";
const SESSION_DAYS = 30;
const BCRYPT_ROUNDS = 12;

export type SessionUser = { id: number; email: string; role: "user" | "admin" };

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: number): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(schema.sessions).values({ id: hashToken(token), userId, expiresAt: expires.toISOString() });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
  // opportunistic cleanup of expired sessions
  void db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date().toISOString()));
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(schema.sessions).where(eq(schema.sessions.id, hashToken(token)));
  jar.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/** Current user from the session cookie, or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.query.sessions.findFirst({ where: eq(schema.sessions.id, hashToken(token)) });
  if (!session || new Date(session.expiresAt) < new Date()) return null;
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, session.userId) });
  if (!user) return null;
  return { id: user.id, email: user.email, role: user.role as SessionUser["role"] };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError("Please sign in to continue.", 401);
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") throw new AuthError("This page is for site administrators only.", 403);
  return user;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/**
 * CSRF protection for state-changing requests: the request must come from our own origin.
 * Browsers always send Origin (or Sec-Fetch-Site) on cross-site POSTs.
 */
export async function assertSameOrigin(): Promise<void> {
  const h = await headers();
  const fetchSite = h.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") throw new AuthError("Request blocked for your safety. Please reload the page and try again.", 403);
  const origin = h.get("origin");
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (origin && host) {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      throw new AuthError("Request blocked for your safety. Please reload the page and try again.", 403);
    }
    if (originHost !== host) throw new AuthError("Request blocked for your safety. Please reload the page and try again.", 403);
  }
}
