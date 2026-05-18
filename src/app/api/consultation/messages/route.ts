import { NextRequest, NextResponse } from "next/server";
import { isConsultationSessionEnforced, verifyConsultationSessionToken } from "@/lib/consultation-session";
import { prisma } from "@/lib/prisma";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function normalizeConsultationId(value: unknown) {
  if (typeof value !== "string") return null;

  const trimmedValue = value.trim();
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(trimmedValue)) return null;

  return trimmedValue;
}

function normalizeMessages(value: unknown): ChatMessage[] | null {
  if (!Array.isArray(value)) return null;

  const messages = value.filter(
    (message): message is ChatMessage =>
      (message?.role === "user" || message?.role === "assistant") && typeof message.content === "string",
  );

  if (messages.length !== value.length) return null;
  return messages;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    consultationId?: unknown;
    messages?: unknown;
    sessionToken?: unknown;
  };

  const consultationId = normalizeConsultationId(body.consultationId);
  const messages = normalizeMessages(body.messages);

  if (!consultationId || !messages) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (isConsultationSessionEnforced()) {
    const sessionToken = typeof body.sessionToken === "string" ? body.sessionToken.trim() : "";
    if (!verifyConsultationSessionToken(sessionToken || null, consultationId)) {
      return NextResponse.json({ error: "Invalid consultation session" }, { status: 401 });
    }
  }

  const paidPayment = await prisma.payment.findFirst({
    where: {
      consultationId,
      status: "paid",
    },
  });

  if (!paidPayment) {
    return NextResponse.json({ error: "Payment is not completed" }, { status: 402 });
  }

  try {
    await prisma.consultation.update({
      where: { id: consultationId },
      data: {
        messagesJson: JSON.stringify(messages),
      },
    });
  } catch {
    return NextResponse.json({ error: "Consultation not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
