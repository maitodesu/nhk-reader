import { NextRequest, NextResponse } from "next/server";
import { getRandomArticleId } from "@/lib/articles";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const id = getRandomArticleId();
  return NextResponse.redirect(new URL(id ? `/article/${id}` : "/", req.url));
}
