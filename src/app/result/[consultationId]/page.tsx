import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isConsultationSessionEnforced, verifyConsultationSessionToken } from "@/lib/consultation-session";
import { prisma } from "@/lib/prisma";

type FortuneResult = {
  summary: string;
  partnerFeelings: string;
  futureFlow: string;
  lineMessages: string[];
  warnings: string[];
  actionPlan: string[];
  premiumPlan?: string[];
};

type ResultPageProps = {
  params: Promise<{ consultationId: string }>;
  searchParams: Promise<{ plan?: string; session?: string }>;
};

function normalizeConsultationId(value: string) {
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(value)) return null;
  return value;
}

function normalizePlan(value: string | undefined) {
  return value === "premium" ? "premium" : "detail";
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "鑑定結果",
    description: "保存済みの鑑定結果です。",
    robots: {
      index: false,
      follow: true,
      googleBot: { index: false, follow: true },
    },
  };
}

function parseResultJson(value: string) {
  try {
    return JSON.parse(value) as FortuneResult;
  } catch {
    return null;
  }
}

export default async function ResultPage({ params, searchParams }: ResultPageProps) {
  const { consultationId: rawConsultationId } = await params;
  const { plan: rawPlan, session: rawSession } = await searchParams;
  const consultationId = normalizeConsultationId(rawConsultationId);
  const plan = normalizePlan(rawPlan);

  if (!consultationId) notFound();

  if (isConsultationSessionEnforced()) {
    if (!verifyConsultationSessionToken(rawSession ?? null, consultationId)) {
      notFound();
    }
  }

  const [paidPayment, savedResult, premiumPaid] = await Promise.all([
    prisma.payment.findFirst({
      where: {
        consultationId,
        plan,
        status: "paid",
      },
    }),
    prisma.fortuneResult.findUnique({
      where: { consultationId_plan: { consultationId, plan } },
    }),
    prisma.payment.findFirst({
      where: {
        consultationId,
        plan: "premium",
        status: "paid",
      },
    }),
  ]);

  if (!paidPayment || !savedResult) notFound();

  const result = parseResultJson(savedResult.resultJson);
  if (!result) notFound();

  const showPremiumUpsell = plan === "detail" && !premiumPaid;

  const sessionQuery =
    rawSession && isConsultationSessionEnforced()
      ? `&session=${encodeURIComponent(rawSession)}`
      : "";

  return (
    <main className="app-shell">
      <header className="site-header">
        <Link className="brand" href="/">
          <span className="brand-mark moon-star" aria-hidden="true" />
          <span>恋占いチャット</span>
        </Link>
        <Link className="ghost-button" href="/">
          新しく相談する
        </Link>
      </header>

      <section className="chat-panel">
        <div className={`chat-heading${plan === "premium" ? " chat-heading-premium" : " chat-heading-detail"}`}>
          <div>
            <p className="eyebrow">保存済み鑑定結果</p>
            <h2>{plan === "premium" ? "プレミアム鑑定結果" : "詳細鑑定結果"}</h2>
          </div>
        </div>

        <div className={`message fortune-result${plan === "premium" ? " fortune-premium" : " fortune-detail"}`}>
          <span
            className={plan === "premium" ? "plan-label plan-label-crown" : "plan-label"}
          >
            {plan === "premium" ? "Premium" : "Detail"}
          </span>
          <h3>{plan === "premium" ? "プレミアム鑑定結果" : "詳細鑑定結果"}</h3>
          <p>{result.summary}</p>

          <section className="fortune-section">
            <h4>相手の本音</h4>
            <p>{result.partnerFeelings}</p>
          </section>
          <section className="fortune-section">
            <h4>2人の今後の流れ</h4>
            <p>{result.futureFlow}</p>
          </section>
          <section className="fortune-section">
            <h4>今送るべきLINE</h4>
            {result.lineMessages.map((line) => (
              <div className="line-card" key={line}>
                {line}
              </div>
            ))}
          </section>
          <section className="fortune-section warning">
            <h4>やってはいけない行動</h4>
            <ul>
              {result.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </section>
          <section className="fortune-section">
            <h4>3日以内に取るべき行動</h4>
            <ol className="action-list">
              {result.actionPlan.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ol>
          </section>
          {plan === "premium" && result.premiumPlan && (
            <section className="fortune-section premium-extra">
              <h4>1週間の行動プラン</h4>
              <ol className="action-list">
                {result.premiumPlan.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ol>
            </section>
          )}
        </div>

        {showPremiumUpsell && (
          <section className="fortune-section premium-upsell-cta">
            <h4>プレミアム鑑定の差分を足す</h4>
            <p>
              LINE文の別パターンと1週間の行動プランまで欲しい方は、同じ相談のまま<strong>480円</strong>
              で追加できます。
            </p>
            <Link
              className="primary-button premium-upsell-link"
              href={`/?continue=1&consultation_id=${consultationId}&plan=detail${sessionQuery}&upsell=premium`}
            >
              チャットでプレミアムに広げる
            </Link>
          </section>
        )}

        <section className="fortune-section result-continue-cta">
          <h4>追加で相談する</h4>
          <p>鑑定のあと、ミラにさらに聞きたいことがあればチャットへ戻れます🌙</p>
          <Link
            className="secondary-button"
            href={`/?continue=1&consultation_id=${consultationId}&plan=${plan}${sessionQuery}`}
          >
            この鑑定の続きをミラに相談する
          </Link>
        </section>
      </section>
    </main>
  );
}
