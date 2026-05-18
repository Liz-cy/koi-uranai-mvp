import Link from "next/link";
import { getSiteDisplayName } from "@/lib/site-identity";

export function SiteFooter() {
  const lineUrl = process.env.NEXT_PUBLIC_LINE_OFFICIAL_URL?.trim();
  const site = getSiteDisplayName();

  return (
    <footer className="site-footer-mini">
      <nav className="site-footer-nav" aria-label="フッター">
        <Link href="/support">お問い合わせ</Link>
        <Link href="/legal/terms">利用規約</Link>
        <Link href="/legal/privacy">プライバシーポリシー</Link>
        <Link href="/legal/tokusho">特定商取引法に基づく表記</Link>
        {lineUrl ? (
          <a href={lineUrl} target="_blank" rel="noopener noreferrer">
            LINE公式
          </a>
        ) : null}
      </nav>
      <p className="site-footer-copy">© {new Date().getFullYear()} {site}</p>
    </footer>
  );
}
