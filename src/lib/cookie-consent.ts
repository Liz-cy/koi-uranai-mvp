export const ANALYTICS_CONSENT_STORAGE_KEY = "koi_analytics_consent";
export type AnalyticsConsentValue = "granted" | "denied";

export function isGaConsentModeEnabled() {
  return process.env.NEXT_PUBLIC_GA_CONSENT_REQUIRED === "true";
}

export function readAnalyticsConsentFromStorage(): AnalyticsConsentValue | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY);
    if (raw === "granted" || raw === "denied") return raw;
    return null;
  } catch {
    return null;
  }
}

export function writeAnalyticsConsent(value: AnalyticsConsentValue) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, value);
    window.dispatchEvent(new Event("koi-analytics-consent"));
  } catch {
    /* ignore */
  }
}

export function canSendGaFromBrowser(): boolean {
  if (!process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim()) return false;
  if (typeof window === "undefined") return false;
  if (!isGaConsentModeEnabled()) return true;
  return readAnalyticsConsentFromStorage() === "granted";
}
