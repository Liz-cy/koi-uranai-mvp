import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CookieConsentBar } from "@/components/CookieConsentBar";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteJsonLd } from "@/components/SiteJsonLd";
import { getSiteDisplayName } from "@/lib/site-identity";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#8f7ae5",
};

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const siteName = getSiteDisplayName();

const googleVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim();
const bingVerification = process.env.BING_SITE_VERIFICATION?.trim();

const siteVerification: Metadata["verification"] | undefined =
  googleVerification || bingVerification
    ? {
        ...(googleVerification ? { google: googleVerification } : {}),
        ...(bingVerification ? { other: { "msvalidate.01": bingVerification } } : {}),
      }
    : undefined;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "恋占いチャット｜月乃ミラ",
  description:
    "登録不要で3往復まで無料。片思い・復縁・LINEの悩みを占い師「月乃ミラ」に相談。深く鑑定するプランは500円から。",
  alternates: {
    canonical: "/",
  },
  ...(siteVerification ? { verification: siteVerification } : {}),
  openGraph: {
    title: "恋占いチャット｜月乃ミラに恋愛相談",
    description:
      "眠れない恋の悩みを、いつでもチャットで。無料相談のあと、本音・LINE・次の一歩まで具体化する鑑定があります。",
    type: "website",
    locale: "ja_JP",
    url: "/",
    siteName,
  },
  twitter: {
    card: "summary_large_image",
    title: "恋占いチャット｜月乃ミラ",
    description: "恋愛相談をチャットで。無料3往復、そのあと単発で深く鑑定。",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <SiteJsonLd siteUrl={siteUrl} />
        <GoogleAnalytics />
        <CookieConsentBar />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
