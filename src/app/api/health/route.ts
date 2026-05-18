import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "up" as const });
  } catch (e) {
    console.error("health check db error", e);
    return NextResponse.json({ ok: false, db: "down" as const }, { status: 503 });
  }
}
