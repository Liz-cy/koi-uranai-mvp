import Link from "next/link";
import { getSiteDisplayName } from "@/lib/site-identity";

export default function NotFound() {
  const site = getSiteDisplayName();

  return (
    <main className="app-shell">
      <header className="site-header">
        <Link className="brand" href="/">
          <span className="brand-mark moon-star" aria-hidden="true" />
          <span>{site}</span>
        </Link>
        <Link className="ghost-button" href="/">
          トップへ
        </Link>
      </header>
      <article className="legal-article" style={{ paddingTop: 32 }}>
        <h1>ページが見つかりません</h1>
        <p className="legal-lead">URL の誤りか、ページが移動した可能性があります。</p>
        <p style={{ marginTop: 24 }}>
          <Link className="primary-button" href="/" style={{ display: "inline-block", padding: "12px 22px" }}>
            トップへ戻る
          </Link>
        </p>
      </article>
    </main>
  );
}
