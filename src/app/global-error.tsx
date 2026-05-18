"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ja">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          fontFamily: '"Yu Gothic", Meiryo, system-ui, sans-serif',
          background: "#f7f2ff",
          color: "#2d2938",
        }}
      >
        <main style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", marginBottom: 12 }}>表示できませんでした</h1>
          <p style={{ lineHeight: 1.7, margin: 0 }}>
            一時的な不具合の可能性があります。ページを再読み込みするか、しばらく時間をおいてからお試しください。
          </p>
        </main>
      </body>
    </html>
  );
}
