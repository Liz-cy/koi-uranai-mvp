import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { sendPurchaseThankYouEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { itemDisplayName, type PaidPlan } from "@/lib/pricing";

async function syncPaymentFromCheckoutSession(session: Stripe.Checkout.Session) {
  const plan = session.metadata?.plan;
  const consultationId = session.metadata?.consultationId;

  if (!consultationId || (plan !== "detail" && plan !== "premium")) {
    return;
  }

  if (session.payment_status === "unpaid") {
    return;
  }

  await prisma.payment.upsert({
    where: { stripeSessionId: session.id },
    create: {
      stripeSessionId: session.id,
      consultationId,
      plan,
      status: "paid",
      amountTotal: session.amount_total,
    },
    update: {
      status: "paid",
      amountTotal: session.amount_total,
    },
  });
}

export async function POST(request: NextRequest) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook is not configured" }, { status: 500 });
  }

  const stripe = new Stripe(stripeSecretKey);
  const body = await request.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid Stripe signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    await syncPaymentFromCheckoutSession(session);
    console.log("Stripe checkout session paid", {
      type: event.type,
      sessionId: session.id,
      plan: session.metadata?.plan,
      consultationId: session.metadata?.consultationId,
      amountTotal: session.amount_total,
      paymentStatus: session.payment_status,
    });

    const buyerEmail = session.customer_details?.email ?? session.customer_email;
    if (buyerEmail && session.payment_status === "paid") {
      const plan = session.metadata?.plan;
      const consultationId = session.metadata?.consultationId;
      if (consultationId && (plan === "detail" || plan === "premium")) {
        const paidPlan: PaidPlan = plan === "premium" ? "premium" : "detail";
        const isUpgrade = session.metadata?.upgradeFrom === "detail";
        const planLabel = itemDisplayName(paidPlan, { upgrade: isUpgrade && paidPlan === "premium" });
        try {
          const sent = await sendPurchaseThankYouEmail(buyerEmail, {
            planLabel,
            amountYen: session.amount_total,
          });
          if (!sent.ok) {
            console.warn("Purchase thank-you email skipped", sent.skippedReason);
          }
        } catch (emailError) {
          console.error("Purchase thank-you email failed", emailError);
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
