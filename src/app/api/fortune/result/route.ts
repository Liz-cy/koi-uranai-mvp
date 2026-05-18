import { NextRequest, NextResponse } from "next/server";
import { isConsultationSessionEnforced, verifyConsultationSessionToken } from "@/lib/consultation-session";
import { prisma } from "@/lib/prisma";

type FortuneResult = {
  summary: string;
  partnerFeelings: string;
  futureFlow: string;
  lineMessages: string[];
  warnings: string[];
  actionPlan: string[];
  premiumPlan?: string[];
};

function normalizeConsultationId(value: unknown) {
  if (typeof value !== "string") return null;

  const trimmedValue = value.trim();
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(trimmedValue)) return null;

  return trimmedValue;
}

function normalizePlan(value: unknown) {
  return value === "premium" ? "premium" : "detail";
}

function parseResultJson(value: string) {
  try {
    return JSON.parse(value) as FortuneResult;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const consultationId = normalizeConsultationId(request.nextUrl.searchParams.get("consultationId"));
  const plan = normalizePlan(request.nextUrl.searchParams.get("plan"));
  const sessionToken = request.nextUrl.searchParams.get("session");

  if (!consultationId) {
    return NextResponse.json({ error: "Invalid consultation ID" }, { status: 400 });
  }

  if (isConsultationSessionEnforced()) {
    if (!verifyConsultationSessionToken(sessionToken, consultationId)) {
      return NextResponse.json({ error: "Invalid consultation session" }, { status: 401 });
    }
  }

  const [paidPayment, savedResult] = await Promise.all([
    prisma.payment.findFirst({
      where: {
        consultationId,
        plan,
        status: "paid",
      },
    }),
    prisma.fortuneResult.findUnique({
      where: { consultationId_plan: { consultationId, plan } },
    }),
  ]);

  if (!paidPayment) {
    return NextResponse.json({ error: "Payment is not completed" }, { status: 402 });
  }

  if (!savedResult) {
    return NextResponse.json({ error: "Fortune result not found" }, { status: 404 });
  }

  const result = parseResultJson(savedResult.resultJson);
  if (!result) {
    return NextResponse.json({ error: "Fortune result is invalid" }, { status: 500 });
  }

  return NextResponse.json({
    consultationId,
    plan,
    result,
    source: savedResult.source,
    createdAt: savedResult.createdAt,
  });
}
