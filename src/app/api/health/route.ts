import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

/** Uptime check: verifies the database answers. */
export async function GET() {
  try {
    await db.run(sql`select 1`);
    return NextResponse.json({ ok: true, time: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "db error" }, { status: 503 });
  }
}
