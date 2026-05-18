import { NextRequest, NextResponse } from "next/server";
import { getRequestIp, rateLimit } from "@/lib/rate-limit";
import { areServiceMocksDisabled } from "@/lib/service-mocks";

type IncomingMessage = {
  role: "user" | "assistant";
  content: string;
};

const miraSystemPrompt = `
あなたは「月乃ミラ」という恋愛相談専門の占い師です。
ユーザーは恋愛で不安になっており、相手の気持ち、復縁、片思い、LINE返信、告白のタイミングなどを相談します。

返答方針:
- 最初にユーザーの気持ちを受け止める
- 優しく、少し親しみのある口調にする
- ミラ本人の文章には 🌙 💌 🔮 🫶 😌 💭 を自然に使う
- ユーザーが実際に送るLINE文には絵文字を入れない
- 相手の気持ちは断定しすぎず、可能性として伝える
- 不安を煽らない
- 復縁、交際、返信の有無を保証しない
- 最後に具体的な次の行動か追加質問を入れる
- 危険な相談では安全確保を最優先する
`;

function createMockReply(messages: IncomingMessage[]) {
  const latest = messages.at(-1)?.content ?? "";

  if (latest.includes("復縁") || latest.includes("元彼") || latest.includes("元カノ")) {
    return [
      "復縁の悩みって、期待と不安が一緒に来るからしんどいですよね🥲💭",
      "今は相手の気持ちを急いで確かめるより、別れた原因と今の距離感を丁寧に見る時期です🌙",
      "まずは重い話を避けて、近況を軽く聞く一通から始めるのが良さそうです💌",
      "別れた理由と、最後に連絡した時期を教えてください🔮",
    ].join("\n");
  }

  if (latest.includes("LINE") || latest.includes("返信") || latest.includes("既読")) {
    return [
      "返信が気になる時間って、ほんとに心がそわそわしますよね😢💭",
      "でも今の流れを見ると、すぐに嫌われたと決めつけなくても大丈夫そうです🌙",
      "送るなら、これくらいがよさそうです💌",
      "「忙しかったら無理しないでね。落ち着いたらまた話せたら嬉しい」",
      "最後に送った内容と、返信が来ていない時間も教えてください🔮",
    ].join("\n");
  }

  return [
    "話してくれてありがとうございます🌙 その状況だと、気持ちが落ち着かなくなるのは自然です😌💭",
    "今の恋の流れは、相手の反応だけで判断するより、これまでの関係性と最近の変化を合わせて見る必要がありそうです🔮",
    "相手との関係性と、最後に起きた出来事をもう少し教えてください💌",
  ].join("\n");
}

export async function POST(request: NextRequest) {
  const limitPerMinute = Number(process.env.CHAT_RATE_LIMIT_PER_MINUTE ?? "40");
  if (Number.isFinite(limitPerMinute) && limitPerMinute > 0) {
    const ip = getRequestIp(request);
    const limited = rateLimit(`chat:${ip}`, limitPerMinute, 60_000);
    if (!limited.ok) {
      const retrySec = Math.max(1, Math.ceil(limited.retryAfterMs / 1000));
      return NextResponse.json(
        { error: "リクエストが多すぎます。少し待ってからもう一度お試しください。" },
        { status: 429, headers: { "Retry-After": String(retrySec) } },
      );
    }
  }

  const body = (await request.json()) as { messages?: IncomingMessage[] };
  const messages = body.messages ?? [];
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    if (areServiceMocksDisabled()) {
      return NextResponse.json(
        { error: "AI相談の設定が完了していません。しばらくしてからお試しください。" },
        { status: 503 },
      );
    }
    return NextResponse.json({ reply: createMockReply(messages), source: "mock" });
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.8,
      messages: [
        { role: "system", content: miraSystemPrompt },
        ...messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      ],
    }),
  });

  if (!response.ok) {
    if (areServiceMocksDisabled()) {
      return NextResponse.json(
        { error: "応答の生成に失敗しました。しばらくしてからお試しください。" },
        { status: 502 },
      );
    }
    return NextResponse.json({ reply: createMockReply(messages), source: "fallback" });
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content?.trim();
  if (!raw && areServiceMocksDisabled()) {
    return NextResponse.json(
      { error: "応答を取得できませんでした。しばらくしてからお試しください。" },
      { status: 502 },
    );
  }
  const reply = raw || createMockReply(messages);

  return NextResponse.json({ reply, source: "openai" });
}
