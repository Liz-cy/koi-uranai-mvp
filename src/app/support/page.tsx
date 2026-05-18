import type { Metadata } from "next";
import Link from "next/link";
import { SupportForm } from "@/components/SupportForm";
import { getContactEmail, getSiteDisplayName } from "@/lib/site-identity";

export const metadata: Metadata = {
  title: "お問い合わせ",
  description: "決済・鑑定・不具合などのお問い合わせ",
  alternates: { canonical: "/support" },
  openGraph: {
    title: "お問い合わせ",
    description: "決済・鑑定・不具合などのお問い合わせ",
    url: "/support",
  },
};

export default function SupportPage() {
  const site = getSiteDisplayName();
  const email = getContactEmail();

  return (
    <main className="app-shell legal-page">
      <header className="site-header">
        <Link className="brand" href="/">
          <span className="brand-mark moon-star" aria-hidden="true" />
          <span>{site}</span>
        </Link>
        <Link className="ghost-button" href="/">
          トップへ
        </Link>
      </header>

      <article className="legal-article support-article">
        <h1>お問い合わせ</h1>
        <p className="legal-lead">
          決済・鑑定内容・動作不具合などございましたら、下記フォームまたはメールにてご連絡ください。返信には数日かかる場合があります。
        </p>
        {email ? (
          <p>
            メール: <a href={`mailto:${email}`}>{email}</a>
          </p>
        ) : (
          <p className="legal-small">運営メール（NEXT_PUBLIC_CONTACT_EMAIL）未設定の場合、フォーム送信には別途 CONTACT_INBOX の設定が必要です。</p>
        )}

        <SupportForm />

        <p className="legal-note">
          <Link href="/legal/tokusho">特定商取引法に基づく表記</Link> ／ <Link href="/legal/privacy">プライバシーポリシー</Link> ／{" "}
          <Link href="/legal/terms">利用規約</Link>
        </p>
      </article>
    </main>
  );
}
