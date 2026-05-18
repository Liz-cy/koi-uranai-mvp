import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createConsultationSessionToken } from "@/lib/consultation-session";
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

function normalizeSessionId(value: unknown) {
  if (typeof value !== "string") return null;

  const trimmedValue = value.trim();
  if (!/^cs_(test|live)_[a-zA-Z0-9]+$/.test(trimmedValue)) return null;

  return trimmedValue;
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

export async function POST(request: NextRequest) {
  const { consultationId: rawConsultationId, sessionId: rawSessionId } = (await request.json()) as {
    consultationId?: unknown;
    sessionId?: unknown;
  };

  const consultationId = normalizeConsultationId(rawConsultationId);
  if (!consultationId) {
    return NextResponse.json({ error: "Invalid consultation ID" }, { status: 400 });
  }

  const sessionId = normalizeSessionId(rawSessionId);
  const consultation = await prisma.consultation.findUnique({
    where: { id: consultationId },
    include: { payments: true },
  });

  if (!consultation) {
    return NextResponse.json({ error: "Consultation not found" }, { status: 404 });
  }

  let paidPayment = consultation.payments.find(
    (payment) => payment.status === "paid" && (!sessionId || payment.stripeSessionId === sessionId),
  );

  if (!paidPayment && sessionId && process.env.STRIPE_SECRET_KEY) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === "paid" && session.metadata?.consultationId === consultationId) {
      paidPayment = await prisma.payment.upsert({
        where: { stripeSessionId: session.id },
        create: {
          stripeSessionId: session.id,
          consultationId,
          plan: session.metadata?.plan ?? consultation.selectedPlan ?? "detail",
          status: "paid",
          amountTotal: session.amount_total,
        },
        update: {
          status: "paid",
          amountTotal: session.amount_total,
        },
      });
    }
  }

  if (!paidPayment) {
    return NextResponse.json({ error: "Payment is not completed" }, { status: 402 });
  }

  const plan = paidPayment.plan === "premium" ? "premium" : "detail";

  return NextResponse.json({
    consultation: {
      id: consultation.id,
      messages: parseMessages(consultation.messagesJson),
      freeTurnsUsed: consultation.freeTurnsUsed,
      plan,
      paymentStatus: paidPayment.status,
    },
    sessionToken: createConsultationSessionToken(consultationId),
    amountTotal: paidPayment.amountTotal,
  });
}
