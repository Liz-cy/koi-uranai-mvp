"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { isGaConsentModeEnabled, readAnalyticsConsentFromStorage } from "@/lib/cookie-consent";

const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();

export function GoogleAnalytics() {
  const [loadScripts, setLoadScripts] = useState(false);

  useEffect(() => {
    function sync() {
      if (!measurementId) {
        setLoadScripts(false);
        return;
      }
      if (!isGaConsentModeEnabled()) {
        setLoadScripts(true);
        return;
      }
      setLoadScripts(readAnalyticsConsentFromStorage() === "granted");
    }

    sync();
    window.addEventListener("koi-analytics-consent", sync);
    return () => window.removeEventListener("koi-analytics-consent", sync);
  }, []);

  if (!measurementId || !loadScripts) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${measurementId}', { anonymize_ip: true });
        `.trim()}
      </Script>
    </>
  );
}
