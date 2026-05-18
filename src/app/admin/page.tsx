import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

type AdminPageProps = {
  searchParams: Promise<{ token?: string }>;
};

function formatYen(value: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function dateKeyJst(value: Date) {
  return value.toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/** 今日を含む過去 `days` 日ぶんの日付キー（新しい日が先頭） */
function rollingDayKeysJst(days: number, now = new Date()) {
  const keys: string[] = [];
  for (let i = 0; i < days; i += 1) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    keys.push(dateKeyJst(d));
  }
  return keys;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const adminToken = process.env.ADMIN_TOKEN;
  const { token } = await searchParams;

  if (!adminToken || token !== adminToken) {
    notFound();
  }

  const stalePendingCutoff = new Date();
  stalePendingCutoff.setTime(stalePendingCutoff.getTime() - 24 * 60 * 60 * 1000);
  const chartStart = new Date();
  chartStart.setDate(chartStart.getDate() - 7);
  chartStart.setHours(0, 0, 0, 0);

  const [
    consultationCount,
    paymentCount,
    paidPayments,
    fortuneResultCount,
    recentPayments,
    paidLast7DaysRaw,
    pendingPaymentCount,
    stalePendingPayments,
  ] = await Promise.all([
    prisma.consultation.count(),
    prisma.payment.count(),
    prisma.payment.findMany({
      where: { status: "paid" },
      orderBy: { createdAt: "desc" },
      include: { consultation: true },
    }),
    prisma.fortuneResult.count(),
    prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { consultation: true },
    }),
    prisma.payment.findMany({
      where: { status: "paid", createdAt: { gte: chartStart } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.payment.count({ where: { status: "pending" } }),
    prisma.payment.findMany({
      where: { status: "pending", createdAt: { lt: stalePendingCutoff } },
      orderBy: { createdAt: "asc" },
      take: 8,
      include: { consultation: true },
    }),
  ]);

  const paidCount = paidPayments.length;
  const salesTotal = paidPayments.reduce((total, payment) => total + (payment.amountTotal ?? 0), 0);
  const detailPaidCount = paidPayments.filter((payment) => payment.plan === "detail").length;
  const premiumPaidCount = paidPayments.filter((payment) => payment.plan === "premium").length;
  const conversionRate = consultationCount > 0 ? Math.round((paidCount / consultationCount) * 1000) / 10 : 0;

  const utmBySource = new Map<string, { count: number; revenue: number }>();
  for (const payment of paidPayments) {
    const label = payment.consultation.utmSource?.trim() || "（直接／不明）";
    const bucket = utmBySource.get(label) ?? { count: 0, revenue: 0 };
    bucket.count += 1;
    bucket.revenue += payment.amountTotal ?? 0;
    utmBySource.set(label, bucket);
  }
  const utmRows = Array.from(utmBySource.entries())
    .map(([utmSource, row]) => ({ utmSource, ...row }))
    .sort((a, b) => b.revenue - a.revenue);

  const dayOrder = rollingDayKeysJst(7);
  const byDay = new Map<string, { count: number; revenue: number }>();
  for (const key of dayOrder) {
    byDay.set(key, { count: 0, revenue: 0 });
  }
  for (const payment of paidLast7DaysRaw) {
    const key = dateKeyJst(payment.createdAt);
    const bucket = byDay.get(key);
    if (bucket) {
      bucket.count += 1;
      bucket.revenue += payment.amountTotal ?? 0;
    }
  }
  const dailyRows = dayOrder.map((key) => ({ key, ...byDay.get(key)! }));
  const weekPaidCount = paidLast7DaysRaw.length;
  const weekRevenue = paidLast7DaysRaw.reduce((total, payment) => total + (payment.amountTotal ?? 0), 0);
  const todayKey = dayOrder[0];
  const todayBucket = byDay.get(todayKey)!;

  const stats = [
    { label: "相談数", value: consultationCount.toLocaleString("ja-JP") },
    { label: "決済作成数", value: paymentCount.toLocaleString("ja-JP") },
    { label: "決済未完了（pending）", value: pendingPaymentCount.toLocaleString("ja-JP") },
    { label: "支払い完了数", value: paidCount.toLocaleString("ja-JP") },
    { label: "売上", value: formatYen(salesTotal) },
    { label: "CVR", value: `${conversionRate}%` },
    { label: "保存済み鑑定", value: fortuneResultCount.toLocaleString("ja-JP") },
  ];

  return (
    <main className="app-shell">
      <header className="site-header">
        <Link className="brand" href="/">
          <span className="brand-mark moon-star" aria-hidden="true" />
          <span>恋占いチャット</span>
        </Link>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <a
            className="ghost-button"
            href={`/api/admin/export?token=${encodeURIComponent(token)}`}
          >
            決済CSV
          </a>
          <Link className="ghost-button" href="/">
            サイトへ戻る
          </Link>
        </div>
      </header>

      <section className="admin-panel">
        <p className="eyebrow">Owner Dashboard</p>
        <h1>管理画面</h1>
        <p className="admin-lead">相談、決済、売上、保存済み鑑定の状況を確認できます。</p>

        <div className="admin-stats">
          {stats.map((stat) => (
            <article className="admin-stat-card" key={stat.label}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </article>
          ))}
        </div>

        {stalePendingPayments.length > 0 ? (
          <section className="admin-card admin-alert-card" style={{ marginBottom: "20px" }}>
            <h2>注意：長時間 pending の決済</h2>
            <p className="admin-lead" style={{ marginTop: 0 }}>
              作成から24時間以上経過し、まだ <code>pending</code> の決済があります。Webhook 未設定・テスト中断・失敗時のStripe側状態などを確認してください。
            </p>
            <div className="admin-list admin-list-dense">
              {stalePendingPayments.map((payment) => (
                <div key={payment.id}>
                  <span>
                    {formatDate(payment.createdAt)} / {payment.plan} / 相談 {payment.consultationId.slice(0, 8)}…
                  </span>
                  <strong>{formatYen(payment.amountTotal ?? 0)}</strong>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <div className="admin-grid admin-grid-3">
          <section className="admin-card">
            <h2>本日（JST）</h2>
            <div className="admin-list">
              <div>
                <span>支払い完了</span>
                <strong>{todayBucket.count.toLocaleString("ja-JP")}件</strong>
              </div>
              <div>
                <span>売上</span>
                <strong>{formatYen(todayBucket.revenue)}</strong>
              </div>
            </div>
          </section>

          <section className="admin-card">
            <h2>直近7日（JST）</h2>
            <div className="admin-list">
              <div>
                <span>支払い完了</span>
                <strong>{weekPaidCount.toLocaleString("ja-JP")}件</strong>
              </div>
              <div>
                <span>売上</span>
                <strong>{formatYen(weekRevenue)}</strong>
              </div>
            </div>
          </section>

          <section className="admin-card admin-card-wide">
            <h2>日別（支払い完了・JST）</h2>
            <div className="admin-list admin-list-dense">
              {dailyRows.map((row) => (
                <div key={row.key}>
                  <span>{row.key}</span>
                  <strong>
                    {row.count}件 / {formatYen(row.revenue)}
                  </strong>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="admin-grid">
          <section className="admin-card">
            <h2>プラン別支払い</h2>
            <div className="admin-list">
              <div>
                <span>詳細鑑定</span>
                <strong>{detailPaidCount.toLocaleString("ja-JP")}件</strong>
              </div>
              <div>
                <span>プレミアム鑑定</span>
                <strong>{premiumPaidCount.toLocaleString("ja-JP")}件</strong>
              </div>
            </div>
          </section>

          <section className="admin-card admin-card-wide">
            <h2>utm_source 別（支払い完了）</h2>
            <p className="admin-lead" style={{ marginTop: 0, marginBottom: "12px", fontSize: "0.92rem" }}>
              初回の流入パラメータを相談作成時に保存した値に基づきます。未設定は「（直接／不明）」です。
            </p>
            <div className="admin-list admin-list-dense">
              {utmRows.length === 0 ? (
                <p>まだ支払い完了データがありません。</p>
              ) : (
                utmRows.map((row) => (
                  <div key={row.utmSource}>
                    <span>{row.utmSource}</span>
                    <strong>
                      {row.count.toLocaleString("ja-JP")}件 / {formatYen(row.revenue)}
                    </strong>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="admin-card">
            <h2>最近の決済</h2>
            <div className="admin-list">
              {recentPayments.length === 0 ? (
                <p>まだ決済データがありません。</p>
              ) : (
                recentPayments.map((payment) => (
                  <div key={payment.id}>
                    <span>
                      {formatDate(payment.createdAt)} / {payment.plan} / {payment.status}
                    </span>
                    <strong>{formatYen(payment.amountTotal ?? 0)}</strong>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
