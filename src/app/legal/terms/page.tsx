import type { Metadata } from "next";
import Link from "next/link";
import { getContactEmail, getOperatorAddress, getOperatorName, getSiteDisplayName } from "@/lib/site-identity";

export const metadata: Metadata = {
  title: "利用規約",
  description: "本サービスの利用条件について",
  alternates: { canonical: "/legal/terms" },
  openGraph: {
    title: "利用規約",
    description: "本サービスの利用条件について",
    url: "/legal/terms",
  },
};

export default function TermsPage() {
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
        <h1>利用規約</h1>
        <p className="legal-lead">
          本規約は「{site}」（以下「本サービス」）の利用条件を定めます。利用開始時点で本規約に同意したものとみなします。未成年者は保護者の同意のうえでご利用ください。
        </p>

        <section>
          <h2>第1条（サービス内容）</h2>
          <p>
            本サービスは、AI を用いた恋愛相談・占い風のコンテンツをチャット形式で提供します。鑑定結果は参考情報であり、将来の結果を保証するものではありません。
          </p>
        </section>

        <section>
          <h2>第2条（アカウント）</h2>
          <p>
            本サービスは登録不要で一部機能をご利用いただけます。有料プランでは決済事業者を通じて代金を決済します。
          </p>
        </section>

        <section>
          <h2>第3条（禁止事項）</h2>
          <p>ユーザーは、以下を行ってはなりません。</p>
          <ul>
            <li>法令または公序良俗に違反する行為、第三者の権利を侵害する行為</li>
            <li>システムへの不正アクセス、負荷試験の無許可実施、Bot による過度な自動利用</li>
            <li>第三者になりすます行為、虚偽の申告</li>
            <li>生成されたコンテンツを業務用に再販する等、運営が不適切と判断する商用利用</li>
          </ul>
        </section>

        <section>
          <h2>第4条（有料サービス）</h2>
          <p>
            料金・支払方法・キャンセル等は
            <Link href="/legal/tokusho">特定商取引法に基づく表記</Link>
            に準じます。デジタルコンテンツの性質上、提供開始後の返金には応じられない場合があります（法令の定めによる場合を除く）。
          </p>
        </section>

        <section>
          <h2>第5条（知的財産）</h2>
          <p>
            本サービスに関するプログラム・デザイン・文章等の著作権その他の権利は運営または正当な権利者に帰属します。私的利用の範囲を超える複製・改変は禁止します。
          </p>
        </section>

        <section>
          <h2>第6条（免責）</h2>
          <p>
            運営は、本サービスの完全性・有用性・第三者とのトラブル解決等について保証しません。システム停止や外部APIの障害により生じた損害について、運営に故意または重過失がある場合を除き責任を負いません。
          </p>
        </section>

        <section>
          <h2>第7条（規約の変更）</h2>
          <p>
            必要に応じて本規約を変更できます。変更後、本サービスを継続利用した場合、変更に同意したものとみなします。
          </p>
        </section>

        <section>
          <h2>第8条（準拠法・管轄）</h2>
          <p>本規約は日本法を準拠法とします。紛争が生じた場合、運営の所在地を管轄する裁判所を第一審の専属的合意管轄とします（消費者契約法その他の強行法規による制限がある場合を除きます）。</p>
        </section>

        <section>
          <h2>お問い合わせ</h2>
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
              {email ? <a href={`mailto:${email}`}>{email}</a> : <span>（NEXT_PUBLIC_CONTACT_EMAIL を設定してください）</span>}
              {" · "}
              <Link href="/support">お問い合わせフォーム</Link>
            </dd>
          </dl>
        </section>

        <p className="legal-note">
          <Link href="/legal/privacy">プライバシーポリシー</Link> ／{" "}
          <Link href="/legal/tokusho">特定商取引法に基づく表記</Link> ／ <Link href="/">トップへ戻る</Link>
        </p>
      </article>
    </main>
  );
}
