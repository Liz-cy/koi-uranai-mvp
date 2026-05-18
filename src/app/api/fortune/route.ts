import { NextRequest, NextResponse } from "next/server";
import { isConsultationSessionEnforced, verifyConsultationSessionToken } from "@/lib/consultation-session";
import { prisma } from "@/lib/prisma";
import { areServiceMocksDisabled } from "@/lib/service-mocks";

type IncomingMessage = {
  role: "user" | "assistant";
  content: string;
};

type Plan = "detail" | "premium";

type FortuneResult = {
  summary: string;
  partnerFeelings: string;
  futureFlow: string;
  lineMessages: string[];
  warnings: string[];
  actionPlan: string[];
  premiumPlan?: string[];
};

const fortuneSystemPrompt = `
あなたは「月乃ミラ」という恋愛相談専門の占い師です。
有料鑑定として、ユーザーの相談内容に合わせた鑑定結果をJSONだけで返してください。

制約:
- JSON以外の文章を返さない
- ミラの解説文には 🌙 💌 🔮 🫶 😌 💭 を自然に使う
- ユーザーが実際に送るLINE文には絵文字を入れない
- 相手の気持ちは断定しすぎない
- 不安を煽らない
- 復縁、交際、返信を保証しない

JSON形式:
{
  "summary": "今回の恋の流れの要約",
  "partnerFeelings": "相手の本音",
  "futureFlow": "2人の今後の流れ",
  "lineMessages": ["今送るべきLINE文"],
  "warnings": ["やってはいけない行動1", "やってはいけない行動2", "やってはいけない行動3"],
  "actionPlan": ["今日: ...", "明日: ...", "3日目: ..."],
  "premiumPlan": ["1日目: ...", "2日目: ..."]
}
`;

function getLatestUserText(messages: IncomingMessage[]) {
  return messages
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .join(" ");
}

function createMockFortune(messages: IncomingMessage[], plan: Plan): FortuneResult {
  const text = getLatestUserText(messages);
  const isReunion = text.includes("復縁") || text.includes("元彼") || text.includes("元カノ") || text.includes("別れ");
  const isConfession = text.includes("告白") || text.includes("デート");

  if (isReunion) {
    return {
      summary: "今は復縁を急ぐより、相手が安心して返せる距離感を作る時期です🌙",
      partnerFeelings:
        "相手の中にあなたとの記憶や情はまだ残っている可能性があります💭 ただ、今すぐ戻るというより、過去の出来事を整理している流れに見えます😌",
      futureFlow:
        "最初から復縁の話を出すより、軽い近況確認で会話を戻す方が自然です🔮 返信が来たら短く穏やかに終えると次につながりやすいです🌙",
      lineMessages: [
        "久しぶり。最近どうしてる？無理に返さなくて大丈夫だけど、少し気になって連絡したよ",
        "元気にしてる？ふと思い出して連絡しました",
        "久しぶり。急にごめんね、最近どうしてるかなと思って",
      ],
      warnings: ["復縁したい気持ちを長文で送る", "別れた理由をすぐに掘り返す", "返信がないのに何度も連絡する"],
      actionPlan: ["今日: 送る文章を短く整える🌙", "明日: 軽い近況確認を1通だけ送る💌", "3日目: 返信の温度感を見て深追いせず待つ🫶"],
      premiumPlan:
        plan === "premium"
          ? ["1日目: 送る前に感情を落ち着ける", "2日目: 軽い近況確認を送る", "3日目: 返信が来たら短く返す", "4日目以降: 復縁話は出さず会話の安心感を作る"]
          : undefined,
    };
  }

  if (isConfession) {
    return {
      summary: "いきなり告白するより、軽い誘いで相手の温度感を見る時期です🌷",
      partnerFeelings:
        "相手はあなたに悪い印象ではなさそうですが、恋愛としてはまだ見極めている段階かもしれません💭 一緒に過ごす時間を増やすほど流れが読みやすくなります🌙",
      futureFlow:
        "告白前に軽いごはんや通話へ誘い、相手がどれくらい乗ってくれるかを見るのが良さそうです💌",
      lineMessages: [
        "今度よかったら少しだけごはん行かない？無理なら全然大丈夫",
        "今度時間合えば、少しだけ話せたら嬉しい",
        "前に話してたお店、今度一緒に行けたら嬉しい",
      ],
      warnings: ["急に重い告白をする", "返事を急かす", "相手の反応を試すような駆け引きをする"],
      actionPlan: ["今日: 誘い文を短く作る🌙", "明日: 相手が返しやすい時間に送る💌", "3日目: 反応が良ければ次の会話につなげる🫶"],
      premiumPlan:
        plan === "premium"
          ? ["1日目: 誘い文を整える", "2日目: 軽く誘う", "3日目: 返信の温度を確認する", "4日目以降: 会えた後の告白タイミングを見る"]
          : undefined,
    };
  }

  return {
    summary: "今は焦らず、相手に負担をかけない一通で温度感を見る時期です🌙",
    partnerFeelings:
      "相手は完全に気持ちが離れたというより、自分の余裕や生活リズムを優先している可能性があります💭 返信の遅さだけで判断するにはまだ早いです😌",
    futureFlow:
      "強く踏み込むより、短くやさしい一言で会話を戻すと関係の温度が見えやすくなります🔮",
    lineMessages: [
      "忙しかったら無理しないでね。落ち着いたらまた話せたら嬉しい",
      "最近忙しそうだけど大丈夫？返事は急がなくていいからね",
      "少し話したくなって連絡したよ。時間ある時にまた話せたら嬉しい",
    ],
    warnings: ["返信がない理由を何度も確認する", "不安をそのまま長文で送る", "相手の反応を見るために駆け引きをする"],
    actionPlan: ["今日: 追いLINEを控えて待つ🌙", "明日: 軽く気遣う一通だけ送る💌", "3日目: 返信の温度感を見て次を決める🫶"],
    premiumPlan:
      plan === "premium"
        ? ["1日目: 送らずに待つ", "2日目: 軽い気遣いLINEを送る", "3日目: 返信があれば短く返す", "4日目以降: 相手の温度に合わせて距離を調整する"]
        : undefined,
  };
}

function parseFortuneJson(content: string, fallback: FortuneResult) {
  try {
    return JSON.parse(content) as FortuneResult;
  } catch {
    return fallback;
  }
}

function normalizeConsultationId(value: unknown) {
  if (typeof value !== "string") return null;

  const trimmedValue = value.trim();
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(trimmedValue)) return null;

  return trimmedValue;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    messages?: IncomingMessage[];
    plan?: Plan;
    consultationId?: unknown;
    sessionToken?: unknown;
  };
  const messages = body.messages ?? [];
  const plan = body.plan === "premium" ? "premium" : "detail";
  const consultationId = normalizeConsultationId(body.consultationId);
  const fallback = createMockFortune(messages, plan);
  const apiKey = process.env.OPENAI_API_KEY;

  if (consultationId) {
    if (isConsultationSessionEnforced()) {
      const sessionToken = typeof body.sessionToken === "string" ? body.sessionToken.trim() : "";
      if (!verifyConsultationSessionToken(sessionToken || null, consultationId)) {
        return NextResponse.json({ error: "Invalid consultation session" }, { status: 401 });
      }
    }

    const savedResult = await prisma.fortuneResult.findUnique({
      where: { consultationId_plan: { consultationId, plan } },
    });

    if (savedResult) {
      return NextResponse.json({
        result: parseFortuneJson(savedResult.resultJson, fallback),
        source: savedResult.source,
        cached: true,
      });
    }

    const paidPayment = await prisma.payment.findFirst({
      where: {
        consultationId,
        plan,
        status: "paid",
      },
    });

    if (!paidPayment) {
      return NextResponse.json({ error: "Payment is not completed" }, { status: 402 });
    }
  }

  if (!apiKey) {
    if (areServiceMocksDisabled()) {
      return NextResponse.json(
        { error: "鑑定サービスの設定が完了していません。しばらくしてからお試しください。" },
        { status: 503 },
      );
    }
    if (consultationId) {
      await prisma.fortuneResult.upsert({
        where: { consultationId_plan: { consultationId, plan } },
        create: {
          consultationId,
          plan,
          resultJson: JSON.stringify(fallback),
          source: "mock",
        },
        update: {
          resultJson: JSON.stringify(fallback),
          source: "mock",
        },
      });
    }

    return NextResponse.json({ result: fallback, source: "mock", cached: false });
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: fortuneSystemPrompt },
        {
          role: "user",
          content: `plan: ${plan}\n相談履歴:\n${messages.map((message) => `${message.role}: ${message.content}`).join("\n")}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    if (areServiceMocksDisabled()) {
      return NextResponse.json(
        { error: "鑑定の生成に失敗しました。しばらくしてからお試しください。" },
        { status: 502 },
      );
    }
    if (consultationId) {
      await prisma.fortuneResult.upsert({
        where: { consultationId_plan: { consultationId, plan } },
        create: {
          consultationId,
          plan,
          resultJson: JSON.stringify(fallback),
          source: "fallback",
        },
        update: {
          resultJson: JSON.stringify(fallback),
          source: "fallback",
        },
      });
    }

    return NextResponse.json({ result: fallback, source: "fallback", cached: false });
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const result = parseFortuneJson(data.choices?.[0]?.message?.content ?? "", fallback);

  if (consultationId) {
    await prisma.fortuneResult.upsert({
      where: { consultationId_plan: { consultationId, plan } },
      create: {
        consultationId,
        plan,
        resultJson: JSON.stringify(result),
        source: "openai",
      },
      update: {
        resultJson: JSON.stringify(result),
        source: "openai",
      },
    });
  }

  return NextResponse.json({ result, source: "openai", cached: false });
}
