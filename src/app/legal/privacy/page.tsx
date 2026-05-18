import type { Metadata } from "next";
import Link from "next/link";
import { getContactEmail, getOperatorAddress, getOperatorName, getSiteDisplayName } from "@/lib/site-identity";

export const metadata: Metadata = {
  title: "プライバシーポリシー",
  description: "個人情報の取り扱い、アクセス解析、決済、外部サービスについて",
  alternates: { canonical: "/legal/privacy" },
  openGraph: {
    title: "プライバシーポリシー",
    description: "個人情報の取り扱い、アクセス解析、決済、外部サービスについて",
    url: "/legal/privacy",
  },
};

export default function PrivacyPage() {
  const site = getSiteDisplayName();
  const operator = getOperatorName();
  const email = getContactEmail();
  const address = getOperatorAddress();

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

      <article className="legal-article">
        <h1>プライバシーポリシー</h1>
        <p className="legal-lead">
          本ページはサービス利用者向けの説明です。内容は変更される場合があります。事業者の正式名称・連絡先は本ページ末尾および特商法表記をご確認ください。
        </p>

        <section>
          <h2>1. 取得する情報</h2>
          <ul>
            <li>チャットで入力された内容（相談テキスト）</li>
            <li>相談・決済に必要な識別子（相談ID、セッション識別に関する情報）</li>
            <li>決済時に決済事業者（Stripe）経由で収集される情報（メールアドレス・決済ステータス等）</li>
            <li>お問い合わせを送る場合の連絡先情報（該当する場合）</li>
            <li>アクセス解析を有効にし、Cookie同意をいただいた場合に Google Analytics により収集される利用状況（匿名化設定の併用例あり）</li>
          </ul>
        </section>

        <section>
          <h2>2. 利用目的</h2>
          <ul>
            <li>チャット・鑑定機能の提供、履歴の保存、サポート</li>
            <li>決済の処理、不正利用の防止、法令に基づく対応</li>
            <li>サービス改善のための集計・分析（同意に基づく GA 等）</li>
            <li>決済完了等の通知メール送信（設定時）</li>
          </ul>
        </section>

        <section>
          <h2>3. 第三者提供・委託</h2>
          <p>
            ホスティング、決済（Stripe）、メール送信（Resend 等を利用する場合）、エラー監視（Sentry 等を利用する場合）、AI
            推論（OpenAI 等を利用する場合）の提供事業者に、上記目的の範囲でデータの取り扱いを委託する場合があります。各事業者のプライバシーポリシーに従います。
          </p>
        </section>

        <section>
          <h2>4. Cookie・同意</h2>
          <p>
            Google Analytics を利用する場合、設定により初回に同意を求めることがあります。拒否した場合、当該解析タグは読み込みません（実装はサイト設定に依存）。
          </p>
        </section>

        <section>
          <h2>5. 保存期間</h2>
          <p>
            相談履歴・決済記録は、法令・紛争対応・サービス運営上必要な期間保存したうえで削除します。詳細は運営ポリシーおよびインフラのバックアップ方針に従います。
          </p>
        </section>

        <section>
          <h2>6. 開示・訂正・削除</h2>
          <p>
            個人情報保護法その他法令に基づく請求については、末尾の連絡先へご連絡ください。本人確認のうえ、合理的な範囲で対応します。
          </p>
        </section>

        <section>
          <h2>7. お問い合わせ</h2>
          <dl className="legal-dl">
            <dt>運営者</dt>
            <dd>{operator}</dd>
            {address ? (
              <>
                <dt>所在地</dt>
                <dd>{address}</dd>
              </>
            ) : null}
            <dt>連絡先</dt>
            <dd>
              {email ? (
                <a href={`mailto:${email}`}>{email}</a>
              ) : (
                <span>（.env の NEXT_PUBLIC_CONTACT_EMAIL を設定してください）</span>
              )}
              {" · "}
              <Link href="/support">お問い合わせフォーム</Link>
            </dd>
          </dl>
        </section>

        <p className="legal-note">
          <Link href="/legal/terms">利用規約</Link> ／ <Link href="/legal/tokusho">特定商取引法に基づく表記</Link> ／{" "}
          <Link href="/">トップへ戻る</Link>
        </p>
      </article>
    </main>
  );
}
