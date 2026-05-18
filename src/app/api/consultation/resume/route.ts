import { NextRequest, NextResponse } from "next/server";
import {
  createConsultationSessionToken,
  isConsultationSessionEnforced,
  verifyConsultationSessionToken,
} from "@/lib/consultation-session";
import { prisma } from "@/lib/prisma";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

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

function parseMessages(messagesJson: string): ChatMessage[] {
  try {
    const parsedValue = JSON.parse(messagesJson);
    if (!Array.isArray(parsedValue)) return [];

    return parsedValue.filter(
      (message): message is ChatMessage =>
        (message?.role === "user" || message?.role === "assistant") && typeof message.content === "string",
    );
  } catch {
    return [];
  }
}

function parseFortuneJson(value: string): FortuneResult | null {
  try {
    return JSON.parse(value) as FortuneResult;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const { consultationId: rawConsultationId, plan: rawPlan, sessionToken: rawSessionToken } = (await request.json()) as {
    consultationId?: unknown;
    plan?: unknown;
    sessionToken?: unknown;
  };

  const consultationId = normalizeConsultationId(rawConsultationId);
  if (!consultationId) {
    return NextResponse.json({ error: "Invalid consultation ID" }, { status: 400 });
  }

  if (isConsultationSessionEnforced()) {
    const sessionToken = typeof rawSessionToken === "string" ? rawSessionToken.trim() : "";
    if (!verifyConsultationSessionToken(sessionToken || null, consultationId)) {
      return NextResponse.json({ error: "Invalid consultation session" }, { status: 401 });
    }
  }

  const plan = normalizePlan(rawPlan);

  const consultation = await prisma.consultation.findUnique({
    where: { id: consultationId },
  });

  if (!consultation) {
    return NextResponse.json({ error: "Consultation not found" }, { status: 404 });
  }

  const paidPayment = await prisma.payment.findFirst({
    where: {
      consultationId,
      plan,
      status: "paid",
    },
  });

  if (!paidPayment) {
    return NextResponse.json({ error: "Payment is not completed" }, { status: 402 });
  }

  const savedFortune = await prisma.fortuneResult.findUnique({
    where: { consultationId_plan: { consultationId, plan } },
  });

  const fortuneResult = savedFortune?.resultJson ? parseFortuneJson(savedFortune.resultJson) : null;

  return NextResponse.json({
    consultation: {
      id: consultationId,
      messages: parseMessages(consultation.messagesJson),
      freeTurnsUsed: consultation.freeTurnsUsed,
      plan,
      fortuneResult,
    },
    sessionToken: createConsultationSessionToken(consultationId),
  });
}
