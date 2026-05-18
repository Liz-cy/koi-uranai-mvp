"use client";

import { useSyncExternalStore } from "react";
import {
  isGaConsentModeEnabled,
  readAnalyticsConsentFromStorage,
  writeAnalyticsConsent,
} from "@/lib/cookie-consent";

const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();

function subscribeConsentBanner(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("koi-analytics-consent", cb);
  return () => window.removeEventListener("koi-analytics-consent", cb);
}

function snapshotNeedsBanner(): boolean {
  if (typeof window === "undefined") return false;
  if (!isGaConsentModeEnabled() || !gaId) return false;
  return readAnalyticsConsentFromStorage() === null;
}

function serverSnapshotNeedsBanner(): boolean {
  return false;
}

export function CookieConsentBar() {
  const open = useSyncExternalStore(subscribeConsentBanner, snapshotNeedsBanner, serverSnapshotNeedsBanner);

  if (!open) return null;

  return (
    <div className="cookie-consent-bar" role="dialog" aria-label="Cookieの同意">
      <p>
        サイトの改善のため、同意いただいた場合のみアクセス解析（Google Analytics）を利用します。不要なら拒否できます。
      </p>
      <div className="cookie-consent-actions">
        <button
          type="button"
          className="ghost-button"
          onClick={() => {
            writeAnalyticsConsent("denied");
          }}
        >
          拒否
        </button>
        <button
          type="button"
          className="primary-button"
          onClick={() => {
            writeAnalyticsConsent("granted");
          }}
        >
          同意する
        </button>
      </div>
    </div>
  );
}
