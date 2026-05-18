import type { Metadata } from "next";
import Link from "next/link";
import { PRICING_JPY } from "@/lib/pricing";
import { getContactEmail, getOperatorAddress, getOperatorName, getSiteDisplayName } from "@/lib/site-identity";

export const metadata: Metadata = {
  title: "特定商取引法に基づく表記",
  description: "料金・支払方法・キャンセル等の表記",
  alternates: { canonical: "/legal/tokusho" },
  openGraph: {
    title: "特定商取引法に基づく表記",
    description: "料金・支払方法・キャンセル等の表記",
    url: "/legal/tokusho",
  },
};

export default function TokushoPage() {
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
        <h1>特定商取引法に基づく表記</h1>

        <dl className="legal-dl tokusho-dl">
          <dt>事業者名</dt>
          <dd>{operator}</dd>

          {address ? (
            <>
              <dt>所在地</dt>
              <dd>{address}</dd>
            </>
          ) : (
            <>
              <dt>所在地</dt>
              <dd>請求があったら遅滞なく開示します（.env の NEXT_PUBLIC_OPERATOR_ADDRESS 推奨）。</dd>
            </>
          )}

          <dt>連絡先</dt>
          <dd>
            {email ? (
              <a href={`mailto:${email}`}>{email}</a>
            ) : (
              <span>（NEXT_PUBLIC_CONTACT_EMAIL を設定してください）</span>
            )}
          </dd>

          <dt>販売価格</dt>
          <dd>
            <ul className="legal-price-list">
              <li>詳細鑑定：{PRICING_JPY.detail.toLocaleString("ja-JP")}円（税込）</li>
              <li>プレミアム鑑定：{PRICING_JPY.premium.toLocaleString("ja-JP")}円（税込）</li>
              <li>
                詳細鑑定購入後のプレミアム差分：{PRICING_JPY.premiumUpgrade.toLocaleString("ja-JP")}
                円（税込）
              </li>
            </ul>
            <p className="legal-small">キャンペーン・クーポン適用時は決済画面の金額が優先されます。</p>
          </dd>

          <dt>商品代金以外の必要料金</dt>
          <dd>インターネット接続料金、通信料金等はお客様のご負担となります。</dd>

          <dt>代金の支払方法</dt>
          <dd>クレジットカード等、決済事業者（Stripe）が提供する方法に準じます。</dd>

          <dt>代金の支払時期</dt>
          <dd>申し込み時に決済が行われる都度、お支払いが確定します。</dd>

          <dt>役務の提供時期</dt>
          <dd>決済完了後、サイト上で鑑定結果を表示できる状態にいたします（通常は直後〜数分以内を目安。混雑時は前後する場合があります）。</dd>

          <dt>返品・キャンセル</dt>
          <dd>
            デジタルコンテンツの性質上、鑑定結果の提供開始後のキャンセル・返金には応じられない場合があります。法令に別段の定めがあるときはこれに従います。決済エラー等の個別対応はお問い合わせください。
          </dd>

          <dt>動作環境</dt>
          <dd>最新の主要ブラウザを推奨します。スマートフォン・タブレットからもご利用いただけます。</dd>
        </dl>

        <p className="legal-note">
          <Link href="/legal/terms">利用規約</Link> ／ <Link href="/legal/privacy">プライバシーポリシー</Link> ／{" "}
          <Link href="/support">お問い合わせ</Link> ／ <Link href="/">トップへ戻る</Link>
        </p>
      </article>
    </main>
  );
}
