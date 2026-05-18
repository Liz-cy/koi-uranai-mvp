import { NextResponse } from "next/server";
import { getRequestIpFromRequest, rateLimit } from "@/lib/rate-limit";
import { sendContactFormEmail } from "@/lib/email";
import { getContactInboxEmail } from "@/lib/site-identity";

const CATEGORY_LABEL: Record<string, string> = {
  payment: "決済・料金",
  fortune: "鑑定・内容",
  bug: "不具合・エラー",
  other: "その他",
};

function simpleEmailOk(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}

export async function POST(req: Request) {
  const inbox = getContactInboxEmail();
  if (!inbox) {
    return NextResponse.json(
      { error: "お問い合わせ先が未設定です。運営にご連絡ください。" },
      { status: 503 },
    );
  }

  const limitPerHour = Math.max(1, Math.min(60, Number(process.env.CONTACT_RATE_LIMIT_PER_HOUR ?? "8") || 8));
  const ip = getRequestIpFromRequest(req);
  const rl = rateLimit(`contact:${ip}`, limitPerHour, 60 * 60 * 1000);
  if (!rl.ok) {
    const retrySec = Math.max(1, Math.ceil(rl.retryAfterMs / 1000));
    return NextResponse.json({ error: "しばらく時間をおいて再度お試しください。" }, { status: 429, headers: { "Retry-After": String(retrySec) } });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエスト形式が不正です。" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "リクエスト形式が不正です。" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const email = typeof b.email === "string" ? b.email.trim() : "";
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const rawCategory = typeof b.category === "string" ? b.category : "";
  const text = typeof b.body === "string" ? b.body.trim() : "";

  if (!simpleEmailOk(email)) {
    return NextResponse.json({ error: "有効なメールアドレスを入力してください。" }, { status: 400 });
  }

  if (!CATEGORY_LABEL[rawCategory]) {
    return NextResponse.json({ error: "種別が不正です。" }, { status: 400 });
  }

  if (text.length < 10 || text.length > 4000) {
    return NextResponse.json({ error: "本文は10〜4000文字で入力してください。" }, { status: 400 });
  }

  const sent = await sendContactFormEmail({
    to: inbox,
    replyTo: email,
    categoryLabel: CATEGORY_LABEL[rawCategory],
    userName: name || undefined,
    message: text,
  });

  if (!sent.ok) {
    return NextResponse.json({ error: "メール送信に失敗しました。しばらくしてから再度お試しください。" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
