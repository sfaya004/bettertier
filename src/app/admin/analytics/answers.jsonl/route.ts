import { NextResponse } from "next/server";
import { AuthError, requireAdmin } from "@/lib/auth";
import { answersToJsonl, listAnswerRecords } from "@/lib/answers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const since = new URL(req.url).searchParams.get("since") ?? undefined;
  const body = answersToJsonl(await listAnswerRecords(since));
  return new NextResponse(body, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "content-disposition": `attachment; filename="bettertier-answers-${new Date().toISOString().slice(0, 10)}.jsonl"` } });
}
