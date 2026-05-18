import { canSendGaFromBrowser } from "@/lib/cookie-consent";

const PURCHASE_LOG_KEY = "koi_ga_purchase:";

function getGtag(): ((...args: unknown[]) => void) | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
}

function gaAllowed() {
  return canSendGaFromBrowser();
}

export function trackGaPurchase(payload: {
  transactionId: string;
  value: number;
  itemId: string;
  itemName: string;
  coupon?: string;
}) {
  if (!gaAllowed()) return;
  const gtag = getGtag();
  if (!gtag) return;
  try {
    const key = `${PURCHASE_LOG_KEY}${payload.transactionId}`;
    if (sessionStorage.getItem(key)) return;
    gtag("event", "purchase", {
      transaction_id: payload.transactionId,
      value: payload.value,
      currency: "JPY",
      coupon: payload.coupon,
      items: [
        {
          item_id: payload.itemId,
          item_name: payload.itemName,
          price: payload.value,
          quantity: 1,
        },
      ],
    });
    sessionStorage.setItem(key, "1");
  } catch {
    /* private mode / storage */
  }
}

export function trackGaBeginCheckout(payload: { value: number; itemId: string; itemName: string }) {
  if (!gaAllowed()) return;
  const gtag = getGtag();
  if (!gtag) return;
  try {
    gtag("event", "begin_checkout", {
      currency: "JPY",
      value: payload.value,
      items: [
        {
          item_id: payload.itemId,
          item_name: payload.itemName,
          price: payload.value,
          quantity: 1,
        },
      ],
    });
  } catch {
    /* ignore */
  }
}
