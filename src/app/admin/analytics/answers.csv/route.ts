import { NextResponse } from "next/server";
import { AuthError, requireAdmin } from "@/lib/auth";
import { answersToCsv, listAnswerRecords } from "@/lib/answers";

export const dynamic = "force-dynamic";

/** Admin-only download of the anonymous answer dataset. */
export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const since = new URL(req.url).searchParams.get("since") ?? undefined;
  const csv = answersToCsv(await listAnswerRecords(since));
  return new NextResponse(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="bettertier-answers-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
