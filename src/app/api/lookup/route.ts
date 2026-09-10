import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { lookupWord } from "@/lib/dictionary";

export async function GET(req: NextRequest) {
  const surface = req.nextUrl.searchParams.get("surface");
  const reading = req.nextUrl.searchParams.get("reading");
  if (!surface) {
    return NextResponse.json({ error: "missing surface" }, { status: 400 });
  }
  const db = getDb();
  const result = lookupWord(db, surface, reading || null);
  return NextResponse.json(result);
}
