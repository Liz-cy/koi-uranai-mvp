import { getSiteDisplayName } from "@/lib/site-identity";

type SiteJsonLdProps = {
  siteUrl: string;
};

export function SiteJsonLd({ siteUrl }: SiteJsonLdProps) {
  const originOnly = siteUrl.replace(/\/$/, "");
  const name = getSiteDisplayName();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name,
    url: `${originOnly}/`,
    description:
      "登録不要で3往復まで無料。片思い・復縁・LINEの悩みを占い師「月乃ミラ」にチャットで相談できるサービス。",
    inLanguage: "ja-JP",
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
