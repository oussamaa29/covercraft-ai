import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Liveness + database check for uptime monitors. Deliberately says nothing
// about why the database is down — the error could contain connection details.
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "up" });
  } catch {
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
