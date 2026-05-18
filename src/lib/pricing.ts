export const PRICING_JPY = {
  detail: 500,
  premium: 980,
  premiumUpgrade: 480,
} as const;

export type PaidPlan = "detail" | "premium";

export function itemDisplayName(plan: PaidPlan, opts?: { upgrade?: boolean }) {
  if (opts?.upgrade) return "プレミアム鑑定（アップグレード）";
  return plan === "premium" ? "プレミアム鑑定" : "詳細鑑定";
}

export function gaItemId(plan: PaidPlan, upgrade: boolean) {
  if (plan === "detail") return "detail";
  return upgrade ? "premium_upgrade" : "premium";
}

/** 成功URLの amount クエリが無効なときのフォールバック */
export function resolvePurchaseAmountJpy(plan: string, upgrade: boolean, amountFromUrl: string | null) {
  const parsed = amountFromUrl ? Number.parseInt(amountFromUrl, 10) : NaN;
  if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  if (upgrade) return PRICING_JPY.premiumUpgrade;
  if (plan === "premium") return PRICING_JPY.premium;
  return PRICING_JPY.detail;
}
