import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createConsultationSessionToken } from "@/lib/consultation-session";
import { prisma } from "@/lib/prisma";
import { PRICING_JPY } from "@/lib/pricing";
import { areServiceMocksDisabled } from "@/lib/service-mocks";

const planConfig = {
  detail: {
    name: "詳細鑑定",
    amount: PRICING_JPY.detail,
  },
  premium: {
    name: "プレミアム鑑定",
    amount: PRICING_JPY.premium,
  },
} as const;

type Plan = keyof typeof planConfig;

function isPlan(value: unknown): value is Plan {
  return value === "detail" || value === "premium";
}

function normalizeConsultationId(value: unknown) {
  if (typeof value !== "string") return null;

  const trimmedValue = value.trim();
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(trimmedValue)) return null;

  return trimmedValue;
}

function normalizeUtmPart(value: unknown, maxLen: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLen) return null;
  return trimmed;
}

function normalizeUpgradeFrom(value: unknown): "detail" | null {
  return value === "detail" ? "detail" : null;
}

export async function POST(request: NextRequest) {
  const {
    plan,
    consultationId: rawConsultationId,
    messages,
    freeTurnsUsed,
    utm,
    upgradeFrom: rawUpgradeFrom,
    applyFirstPurchasePromo: rawApplyFirstPurchasePromo,
  } = (await request.json()) as {
    plan?: unknown;
    consultationId?: unknown;
    messages?: unknown;
    freeTurnsUsed?: unknown;
    utm?: { source?: unknown; medium?: unknown; campaign?: unknown };
    upgradeFrom?: unknown;
    applyFirstPurchasePromo?: unknown;
  };

  if (!isPlan(plan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const consultationId = normalizeConsultationId(rawConsultationId);
  if (!consultationId) {
    return NextResponse.json({ error: "Invalid consultation ID" }, { status: 400 });
  }

  const upgradeFrom = normalizeUpgradeFrom(rawUpgradeFrom);
  if (upgradeFrom && plan !== "premium") {
    return NextResponse.json({ error: "Invalid upgrade request" }, { status: 400 });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  let lineAmount: number = planConfig[plan].amount;
  let productName: string = planConfig[plan].name;
  let productDescription: string = "恋占いチャットの有料鑑定";
  let mockStripeSessionId = `mock_${consultationId}_${plan}`;

  if (plan === "premium" && upgradeFrom === "detail") {
    const detailPaid = await prisma.payment.findFirst({
      where: { consultationId, plan: "detail", status: "paid" },
    });
    if (!detailPaid) {
      return NextResponse.json({ error: "詳細鑑定のお支払いが確認できません" }, { status: 400 });
    }
    const premiumPaid = await prisma.payment.findFirst({
      where: { consultationId, plan: "premium", status: "paid" },
    });
    if (premiumPaid) {
      return NextResponse.json({ error: "すでにプレミアム鑑定をご利用済みです" }, { status: 400 });
    }
    lineAmount = PRICING_JPY.premiumUpgrade;
    productName = "プレミアム鑑定（アップグレード）";
    productDescription = "詳細鑑定に続く差分内容（LINE文の候補追加・1週間プランなど）です。";
    mockStripeSessionId = `mock_${consultationId}_premium_upgrade`;
  }

  const messagesJson = JSON.stringify(Array.isArray(messages) ? messages : []);
  const safeFreeTurnsUsed = typeof freeTurnsUsed === "number" ? freeTurnsUsed : 0;
  const utmSource = normalizeUtmPart(utm?.source, 120);
  const utmMedium = normalizeUtmPart(utm?.medium, 120);
  const utmCampaign = normalizeUtmPart(utm?.campaign, 120);

  await prisma.consultation.upsert({
    where: { id: consultationId },
    create: {
      id: consultationId,
      messagesJson,
      freeTurnsUsed: safeFreeTurnsUsed,
      selectedPlan: plan,
      utmSource: utmSource ?? undefined,
      utmMedium: utmMedium ?? undefined,
      utmCampaign: utmCampaign ?? undefined,
    },
    update: {
      messagesJson,
      freeTurnsUsed: safeFreeTurnsUsed,
      selectedPlan: plan,
    },
  });

  const upgradeQuery = upgradeFrom === "detail" ? "&upgrade=1" : "";
  const amountQuery = `&amount=${lineAmount}`;

  if (!stripeSecretKey) {
    if (areServiceMocksDisabled()) {
      return NextResponse.json(
        { error: "決済の設定が完了していません。しばらくしてからお試しください。" },
        { status: 503 },
      );
    }
    await prisma.payment.upsert({
      where: { stripeSessionId: mockStripeSessionId },
      create: {
        stripeSessionId: mockStripeSessionId,
        consultationId,
        plan,
        status: "paid",
        amountTotal: lineAmount,
      },
      update: {
        status: "paid",
        amountTotal: lineAmount,
      },
    });

    return NextResponse.json({
      checkoutUrl: `${appUrl}/?checkout=mock-success&plan=${plan}&consultation_id=${consultationId}${amountQuery}${upgradeQuery}`,
      mock: true,
      sessionToken: createConsultationSessionToken(consultationId),
    });
  }

  let stripeDiscounts: { promotion_code: string }[] | undefined;
  const applyFirstPurchasePromo = rawApplyFirstPurchasePromo === true;
  const firstPromoId = process.env.STRIPE_FIRST_PURCHASE_PROMOTION_CODE_ID?.trim();
  if (!upgradeFrom && applyFirstPurchasePromo && firstPromoId) {
    const paidBefore = await prisma.payment.count({
      where: { consultationId, status: "paid" },
    });
    if (paidBefore === 0) {
      stripeDiscounts = [{ promotion_code: firstPromoId }];
    }
  }

  const stripe = new Stripe(stripeSecretKey);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: `${appUrl}/?checkout=success&plan=${plan}&consultation_id=${consultationId}${amountQuery}${upgradeQuery}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/?checkout=cancel&plan=${plan}&consultation_id=${consultationId}`,
    allow_promotion_codes: !stripeDiscounts?.length,
    ...(stripeDiscounts?.length ? { discounts: stripeDiscounts } : {}),
    line_items: [
      {
        price_data: {
          currency: "jpy",
          product_data: {
            name: productName,
            description: productDescription,
          },
          unit_amount: lineAmount,
        },
        quantity: 1,
      },
    ],
    metadata: {
      plan,
      consultationId,
      ...(upgradeFrom === "detail" ? { upgradeFrom: "detail" } : {}),
    },
  });

  await prisma.payment.create({
    data: {
      consultationId,
      stripeSessionId: session.id,
      plan,
      status: "pending",
      amountTotal: lineAmount,
    },
  });

  return NextResponse.json({
    checkoutUrl: session.url,
    mock: false,
    sessionToken: createConsultationSessionToken(consultationId),
  });
}
