"use client";

import { trackGaBeginCheckout, trackGaPurchase } from "@/lib/analytics";
import { gaItemId, itemDisplayName, PRICING_JPY, resolvePurchaseAmountJpy, type PaidPlan } from "@/lib/pricing";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type FortuneResult = {
  summary: string;
  partnerFeelings: string;
  futureFlow: string;
  lineMessages: string[];
  warnings: string[];
  actionPlan: string[];
  premiumPlan?: string[];
};

const freeTurnLimit = 3;
/** API 返信後、タイプライター開始までの間（相手が考えている感） */
const assistantReplyPauseMs = 2200;
/** タイプライター 1 文字あたりの間隔（絵文字・サロゲートペアは Array.from で 1 単位） */
const typewriterCharDelayMs = 26;
const pendingCheckoutStorageKey = "koi_uranai_pending_checkout";
const firstTouchUtmStorageKey = "koi_uranai_utm";

type StoredFirstTouchUtm = {
  source: string | null;
  medium: string | null;
  campaign: string | null;
};

function readStoredFirstTouchUtm(): StoredFirstTouchUtm | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(firstTouchUtmStorageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredFirstTouchUtm>;
    return {
      source: typeof parsed.source === "string" ? parsed.source : null,
      medium: typeof parsed.medium === "string" ? parsed.medium : null,
      campaign: typeof parsed.campaign === "string" ? parsed.campaign : null,
    };
  } catch {
    return null;
  }
}

function buildUtmPayloadForCheckout(): { source?: string; medium?: string; campaign?: string } | undefined {
  const stored = readStoredFirstTouchUtm();
  if (!stored) return undefined;
  const out: { source?: string; medium?: string; campaign?: string } = {};
  if (stored.source) out.source = stored.source;
  if (stored.medium) out.medium = stored.medium;
  if (stored.campaign) out.campaign = stored.campaign;
  return Object.keys(out).length ? out : undefined;
}

function consultationSessionStorageKey(consultationId: string) {
  return `koi_uranai_session_${consultationId}`;
}

function saveConsultationSessionToStorage(consultationId: string, sessionToken: string) {
  window.localStorage.setItem(consultationSessionStorageKey(consultationId), sessionToken);
}

function loadConsultationSessionFromStorage(consultationId: string): string | null {
  return window.localStorage.getItem(consultationSessionStorageKey(consultationId));
}
const initialMessages: ChatMessage[] = [
  {
    role: "assistant",
    content:
      "こんばんは🌙 恋の悩みを聞かせてください💌\n相手との関係、最近あった出来事、あなたが一番知りたいことを教えてくれれば、今の流れを一緒に見ていきます🔮",
  },
];

const starterTemplates = [
  {
    label: "片思いの悩み",
    text: "片思い中の相手がいます。最近、相手の態度が少し変わった気がして不安です。一番知りたいのは、相手が私をどう思っているかです。",
  },
  {
    label: "復縁したい",
    text: "元恋人と復縁したいです。別れてから少し時間が経っていますが、まだ気持ちがあります。一番知りたいのは、復縁の可能性と今連絡していいかです。",
  },
  {
    label: "LINEの返信",
    text: "好きな人からの返信が遅くて不安です。最後に送ったLINEのあと、まだ返事が来ていません。一番知りたいのは、次にどんなLINEを送ればいいかです。",
  },
];

async function requestMiraReply(messages: ChatMessage[]) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, mode: "consultation" }),
  });

  const data = (await response.json().catch(() => ({}))) as { reply?: string; error?: string };
  if (!response.ok) {
    throw new Error(data.error || "AI response failed");
  }
  if (typeof data.reply !== "string") {
    throw new Error("AI response failed");
  }
  return data.reply;
}

async function requestFortuneResult(
  messages: ChatMessage[],
  plan: "detail" | "premium",
  consultationId: string | null,
  sessionToken: string | null,
) {
  const response = await fetch("/api/fortune", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, plan, consultationId, sessionToken: sessionToken ?? undefined }),
  });

  const data = (await response.json().catch(() => ({}))) as { result?: FortuneResult; error?: string };
  if (!response.ok) {
    throw new Error(data.error || "Fortune response failed");
  }
  if (!data.result) {
    throw new Error("Fortune response failed");
  }
  return data.result;
}

async function persistConsultationMessages(
  consultationId: string,
  messages: ChatMessage[],
  sessionToken: string | null,
) {
  await fetch("/api/consultation/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      consultationId,
      messages,
      sessionToken: sessionToken ?? undefined,
    }),
  });
}

async function resumePaidConsultation(
  consultationId: string,
  plan: "detail" | "premium",
  sessionToken: string | null,
) {
  const response = await fetch("/api/consultation/resume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      consultationId,
      plan,
      sessionToken: sessionToken ?? undefined,
    }),
  });

  if (!response.ok) throw new Error("Consultation resume failed");

  const data = (await response.json()) as {
    consultation: {
      id: string;
      messages: ChatMessage[];
      freeTurnsUsed: number;
      plan: "detail" | "premium";
      fortuneResult: FortuneResult | null;
    };
    sessionToken?: string | null;
  };

  return {
    consultation: data.consultation,
    sessionToken: data.sessionToken ?? null,
  };
}

async function restorePaidConsultation(consultationId: string, sessionId: string | null) {
  const response = await fetch("/api/checkout/restore", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ consultationId, sessionId }),
  });

  if (!response.ok) throw new Error("Checkout restore failed");

  const data = (await response.json()) as {
    consultation: {
      id: string;
      messages: ChatMessage[];
      freeTurnsUsed: number;
      plan: "detail" | "premium";
      paymentStatus: "paid";
    };
    sessionToken?: string | null;
    amountTotal?: number | null;
  };

  return {
    consultation: data.consultation,
    sessionToken: data.sessionToken ?? null,
    amountTotal: typeof data.amountTotal === "number" ? data.amountTotal : null,
  };
}

function getPendingCheckout() {
  try {
    const rawValue = window.localStorage.getItem(pendingCheckoutStorageKey);
    if (!rawValue) return null;

    return JSON.parse(rawValue) as {
      plan: "detail" | "premium";
      consultationId: string;
      messages: ChatMessage[];
      freeTurnsUsed: number;
    };
  } catch {
    return null;
  }
}

function createConsultationId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `consultation_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function savePendingCheckout(
  plan: "detail" | "premium",
  consultationId: string,
  messages: ChatMessage[],
  freeTurnsUsed: number,
) {
  window.localStorage.setItem(
    pendingCheckoutStorageKey,
    JSON.stringify({
      plan,
      consultationId,
      messages,
      freeTurnsUsed,
      createdAt: new Date().toISOString(),
    }),
  );
}

function clearPendingCheckout() {
  window.localStorage.removeItem(pendingCheckoutStorageKey);
}

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [freeTurnsUsed, setFreeTurnsUsed] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreamingReply, setIsStreamingReply] = useState(false);
  const chatBusy = isLoading || isStreamingReply;
  const [showPaywall, setShowPaywall] = useState(false);
  const [paidMode, setPaidMode] = useState(false);
  const [fortunePlan, setFortunePlan] = useState<"detail" | "premium" | null>(null);
  const [fortuneResult, setFortuneResult] = useState<FortuneResult | null>(null);
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutNotice, setCheckoutNotice] = useState("");
  const [resultConsultationId, setResultConsultationId] = useState<string | null>(null);
  const [consultationSessionToken, setConsultationSessionToken] = useState<string | null>(null);
  const didProcessCheckout = useRef(false);
  const scrollPremiumUpsellFromResultRef = useRef(false);
  const premiumUpsellCardRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  const scrollToChatAndFocusInput = useCallback(() => {
    document.getElementById("chat")?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      chatInputRef.current?.focus();
    }, 350);
  }, []);

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isLoading, isStreamingReply]);

  const unlockFortune = useCallback(
    async (
      plan: "detail" | "premium",
      sourceMessages: ChatMessage[],
      consultationId: string | null,
      sessionToken: string | null,
    ) => {
      setFortunePlan(plan);
      setPaidMode(true);
      setShowPaywall(false);
      setResultConsultationId(consultationId);
      setCheckoutError("");
      if (consultationId && sessionToken) {
        setConsultationSessionToken(sessionToken);
        saveConsultationSessionToStorage(consultationId, sessionToken);
      }
      setIsLoading(true);

      try {
        const tokenForRequest = sessionToken ?? (consultationId ? loadConsultationSessionFromStorage(consultationId) : null);
        const result = await requestFortuneResult(sourceMessages, plan, consultationId, tokenForRequest);
        setFortuneResult(result);
      } catch (err) {
        const msg =
          err instanceof Error && err.message && err.message !== "Fortune response failed"
            ? err.message
            : "鑑定結果を作成できませんでした。少し時間を置いてもう一度お試しください。";
        setCheckoutError(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!scrollPremiumUpsellFromResultRef.current || !premiumUpsellCardRef.current) return;
    if (fortunePlan !== "detail" || !fortuneResult) return;
    premiumUpsellCardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    scrollPremiumUpsellFromResultRef.current = false;
  }, [fortunePlan, fortuneResult]);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const source = params.get("utm_source")?.trim();
      const medium = params.get("utm_medium")?.trim();
      const campaign = params.get("utm_campaign")?.trim();
      if (!source && !medium && !campaign) return;
      if (window.localStorage.getItem(firstTouchUtmStorageKey)) return;
      window.localStorage.setItem(
        firstTouchUtmStorageKey,
        JSON.stringify({
          source: source || null,
          medium: medium || null,
          campaign: campaign || null,
        }),
      );
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => {
    if (didProcessCheckout.current) return;

    const params = new URLSearchParams(window.location.search);

    if (params.get("continue") === "1") {
      const resumeConsultationId = params.get("consultation_id");
      const resumePlan = params.get("plan");
      const sessionFromUrl = params.get("session");

      if (resumeConsultationId && (resumePlan === "detail" || resumePlan === "premium")) {
        didProcessCheckout.current = true;

        window.setTimeout(async () => {
          try {
            const sessionForResume =
              sessionFromUrl ?? loadConsultationSessionFromStorage(resumeConsultationId);

            const resumed = await resumePaidConsultation(resumeConsultationId, resumePlan, sessionForResume);
            const consultation = resumed.consultation;
            const sessionToken =
              resumed.sessionToken ??
              sessionForResume ??
              loadConsultationSessionFromStorage(consultation.id);
            const restoredMessages =
              consultation.messages.length > 0 ? consultation.messages : initialMessages;

            setMessages(restoredMessages);
            setFreeTurnsUsed(consultation.freeTurnsUsed);
            setPaidMode(true);
            setShowPaywall(false);
            setFortunePlan(resumePlan);
            setResultConsultationId(consultation.id);
            if (sessionToken) {
              setConsultationSessionToken(sessionToken);
              saveConsultationSessionToStorage(consultation.id, sessionToken);
            }

            if (consultation.fortuneResult) {
              setFortuneResult(consultation.fortuneResult);
            } else {
              setFortuneResult(null);
              void unlockFortune(resumePlan, restoredMessages, consultation.id, sessionToken);
            }

            setCheckoutNotice("保存済みの鑑定から続けて相談できます💌");
            if (params.get("upsell") === "premium" && resumePlan === "detail") {
              scrollPremiumUpsellFromResultRef.current = true;
            }
            window.history.replaceState({}, "", window.location.pathname || "/");
          } catch {
            setCheckoutNotice("相談の読み込みに失敗しました。トップからやり直してください🌙");
          }
        }, 0);
        return;
      }
    }

    const checkout = params.get("checkout");
    const plan = params.get("plan");
    const consultationId = params.get("consultation_id");
    const sessionId = params.get("session_id");

    if ((plan !== "detail" && plan !== "premium") || !checkout) return;

    didProcessCheckout.current = true;

    if (checkout === "success" || checkout === "mock-success") {
      window.setTimeout(async () => {
        try {
          if (!consultationId) throw new Error("Missing consultation ID");

          const { consultation: restoredConsultation, sessionToken, amountTotal: restoredAmount } =
            await restorePaidConsultation(consultationId, sessionId);
          const token =
            sessionToken ?? loadConsultationSessionFromStorage(consultationId);

          setMessages(restoredConsultation.messages);
          setFreeTurnsUsed(restoredConsultation.freeTurnsUsed);
          if (token) {
            setConsultationSessionToken(token);
            saveConsultationSessionToStorage(consultationId, token);
          }
          setCheckoutNotice("決済が完了しました。鑑定結果を表示しています🔮");
          clearPendingCheckout();
          const amountParam = params.get("amount");
          const planKey: PaidPlan = plan === "premium" ? "premium" : "detail";
          const isPurchaseUpgrade = planKey === "premium" && params.get("upgrade") === "1";
          const purchaseValueFromDb =
            typeof restoredAmount === "number" && restoredAmount > 0 ? restoredAmount : null;
          const purchaseValue =
            purchaseValueFromDb ?? resolvePurchaseAmountJpy(planKey, isPurchaseUpgrade, amountParam);
          const transactionId = sessionId?.trim() || `mock_${consultationId}_${planKey}${isPurchaseUpgrade ? "_up" : ""}`;
          trackGaPurchase({
            transactionId,
            value: purchaseValue,
            itemId: gaItemId(planKey, isPurchaseUpgrade),
            itemName: itemDisplayName(planKey, { upgrade: isPurchaseUpgrade }),
          });
          void unlockFortune(
            restoredConsultation.plan,
            restoredConsultation.messages,
            restoredConsultation.id,
            token,
          );
          return;
        } catch {
          const pendingCheckout = getPendingCheckout();
          const matchedCheckout =
            pendingCheckout && pendingCheckout.consultationId === consultationId ? pendingCheckout : null;

          setMessages(matchedCheckout?.messages ?? initialMessages);
          setFreeTurnsUsed(matchedCheckout?.freeTurnsUsed ?? freeTurnLimit);
          setShowPaywall(true);
          setCheckoutNotice("決済確認に時間がかかっています。少し待ってからページを再読み込みしてください🌙");
        }
      }, 0);
      return;
    }

    if (checkout === "cancel") {
      window.setTimeout(() => {
        const pendingCheckout = getPendingCheckout();
        const matchedCheckout =
          pendingCheckout && pendingCheckout.consultationId === consultationId ? pendingCheckout : null;

        if (matchedCheckout) {
          setMessages(matchedCheckout.messages);
          setFreeTurnsUsed(matchedCheckout.freeTurnsUsed);
        }

        setShowPaywall(true);
        setCheckoutNotice("決済はキャンセルされました。必要な時にいつでも鑑定できます🌙");
      }, 0);
    }
  }, [unlockFortune]);

  const remainingTurns = Math.max(freeTurnLimit - freeTurnsUsed, 0);
  const counterText = useMemo(() => {
    if (paidMode) return "鑑定後の追加相談ができます";
    if (showPaywall) return "無料相談はここまでです";
    return `無料相談 残り${remainingTurns}往復`;
  }, [paidMode, remainingTurns, showPaywall]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = input.trim();
    if (!text || chatBusy || (showPaywall && !paidMode)) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);

    try {
      const reply = await requestMiraReply(nextMessages);
      await sleep(assistantReplyPauseMs);
      setIsLoading(false);

      setIsStreamingReply(true);
      const chars = Array.from(reply);
      setMessages([...nextMessages, { role: "assistant", content: "" }]);

      for (let i = 1; i <= chars.length; i++) {
        const partial = chars.slice(0, i).join("");
        setMessages([...nextMessages, { role: "assistant", content: partial }]);
        await sleep(typewriterCharDelayMs);
      }

      const finalMessages: ChatMessage[] = [...nextMessages, { role: "assistant", content: reply }];
      setMessages(finalMessages);

      if (paidMode && resultConsultationId) {
        void persistConsultationMessages(
          resultConsultationId,
          finalMessages,
          consultationSessionToken ?? loadConsultationSessionFromStorage(resultConsultationId),
        );
      }

      if (!paidMode) {
        const nextTurns = freeTurnsUsed + 1;
        setFreeTurnsUsed(nextTurns);
        if (nextTurns >= freeTurnLimit) setShowPaywall(true);
      }
    } catch (err) {
      const fallbackAssistant =
        "ごめんなさい、今うまく鑑定できませんでした😢 少し時間を置いてもう一度送ってください🌙";
      const msg =
        err instanceof Error &&
        err.message &&
        err.message !== "AI response failed" &&
        err.message !== "Fortune response failed"
          ? err.message
          : fallbackAssistant;
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: msg,
        },
      ]);
    } finally {
      setIsLoading(false);
      setIsStreamingReply(false);
    }
  }

  async function startCheckout(plan: "detail" | "premium", opts?: { upgradeFrom?: "detail" }) {
    setIsLoading(true);
    setCheckoutError("");
    const upgrading =
      opts?.upgradeFrom === "detail" &&
      plan === "premium" &&
      paidMode &&
      fortunePlan === "detail" &&
      Boolean(resultConsultationId);
    const consultationId =
      upgrading && resultConsultationId ? resultConsultationId : createConsultationId();
    savePendingCheckout(plan, consultationId, messages, freeTurnsUsed);

    try {
      const utm = buildUtmPayloadForCheckout();
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          consultationId,
          messages,
          freeTurnsUsed,
          ...(upgrading ? { upgradeFrom: "detail" as const } : { applyFirstPurchasePromo: true }),
          ...(utm ? { utm } : {}),
        }),
      });

      if (!response.ok) {
        const errBody = (await response.json().catch(() => null)) as { error?: string } | null;
        if (errBody?.error) setCheckoutError(errBody.error);
        throw new Error("Checkout failed");
      }

      const data = (await response.json()) as {
        checkoutUrl?: string;
        mock?: boolean;
        sessionToken?: string | null;
      };

      if (data.sessionToken) {
        setConsultationSessionToken(data.sessionToken);
        saveConsultationSessionToStorage(consultationId, data.sessionToken);
      }

      if (data.mock) {
        await unlockFortune(plan, messages, consultationId, data.sessionToken ?? null);
        return;
      }

      if (data.checkoutUrl) {
        const beginUpgrade = upgrading;
        const beginValue = beginUpgrade
          ? PRICING_JPY.premiumUpgrade
          : plan === "premium"
            ? PRICING_JPY.premium
            : PRICING_JPY.detail;
        trackGaBeginCheckout({
          value: beginValue,
          itemId: gaItemId(plan, beginUpgrade),
          itemName: itemDisplayName(plan, { upgrade: beginUpgrade }),
        });
        window.location.href = data.checkoutUrl;
      }
    } catch {
      setCheckoutError((prev) => prev || "決済画面を開けませんでした。少し時間を置いてもう一度お試しください。");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="site-header">
        <div className="brand">
          <span className="brand-mark moon-star" aria-hidden="true" />
          <span>恋占いチャット</span>
        </div>
        <a className="ghost-button" href="#chat">
          相談する
        </a>
      </header>

      <section className="hero">
        <p className="eyebrow">登録なしで3往復まで無料</p>
        <h1>
          眠れない恋の悩みを、
          <br />
          いつでも占い師に相談。
        </h1>
        <p className="hero-copy">
          片思い、復縁、曖昧な関係、LINE返信まで。占い師「月乃ミラ」があなたの気持ちに寄り添って、次の一歩を一緒に考えます。
        </p>
        <div className="hero-actions">
          <a className="primary-button" href="#chat">
            無料で相談をはじめる
          </a>
          <p>深夜の不安も、まずはここに書いて大丈夫。</p>
        </div>
      </section>

      {checkoutNotice && <div className="checkout-notice">{checkoutNotice}</div>}

      <section className="cards-section">
        <h2>こんな悩みを相談できます</h2>
        <div className="topic-grid">
          {["相手の気持ち", "復縁", "LINE返信", "片思い", "告白", "曖昧な関係"].map((topic) => (
            <button
              key={topic}
              type="button"
              className="topic-card"
              onClick={() => {
                setInput(`${topic}について相談したいです。`);
                scrollToChatAndFocusInput();
              }}
            >
              {topic}
            </button>
          ))}
        </div>
      </section>

      <section className="trust-section">
        <h2>安心して相談するために</h2>
        <div className="trust-grid">
          <div>
            <strong>不安を煽りません</strong>
            <p>「絶対」や「今すぐ課金しないと危ない」のような言い方はしません。</p>
          </div>
          <div>
            <strong>行動まで整理します</strong>
            <p>占い風の見立てだけでなく、次に送るLINEや待つ期間まで具体化します。</p>
          </div>
          <div>
            <strong>危険な相談は安全優先</strong>
            <p>暴力、自傷、ストーカーなどの相談では、占いより安全確保を優先します。</p>
          </div>
        </div>
      </section>

      <section className="chat-panel" id="chat">
        <div className="chat-header">
          <div className="advisor">
            <div className="advisor-icon moon-star" aria-hidden="true" />
            <div>
              <h2>月乃ミラ</h2>
              <p>恋の流れを読む占い師</p>
            </div>
          </div>
          <span className="status-dot">相談受付中</span>
        </div>

        <div className="free-counter">{counterText}</div>

        <div className="messages" ref={messagesContainerRef}>
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`message ${message.role === "assistant" ? "assistant" : "user"}`}>
              {message.content}
            </div>
          ))}
          {isLoading && (
            <div className="message assistant typing-indicator">
              <span>月乃ミラが入力中</span>
              <div className="typing-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
            </div>
          )}
        </div>

        {!messages.some((message) => message.role === "user") && (
          <div className="starter-guide">
            <span className="guide-label">相談の書き方</span>
            <h3>まずはこの3つを教えてください</h3>
            <p>完璧に書かなくて大丈夫です。分かるところだけで、ミラが一緒に整理します🌙</p>
            <div className="template-buttons">
              {starterTemplates.map((template) => (
                <button
                  key={template.label}
                  type="button"
                  onClick={() => {
                    setInput(template.text);
                    scrollToChatAndFocusInput();
                  }}
                >
                  {template.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {showPaywall && !paidMode && (
          <div className="message paywall">
            <h3>無料相談はここまでです🌙</h3>
            <p>ここまでのお話から、今の恋の流れはかなり見えてきました🔮</p>
            <p>さらに詳しく見ると、相手の本音、今後の変化、今送るべきLINEまで具体的に鑑定できます💌</p>
            <p className="paywall-trust">
              お支払いは Stripe の安全なページで完了します。単発課金で、勝手な自動更新はありません。クーポンコードがあれば決済画面で入力できます。
            </p>
            <div className="plan-buttons">
              <button
                className="secondary-button paywall-plan-detail"
                type="button"
                onClick={() => startCheckout("detail")}
                disabled={chatBusy}
              >
                詳細鑑定 500円
              </button>
              <button
                className="primary-button paywall-plan-premium"
                type="button"
                onClick={() => startCheckout("premium")}
                disabled={chatBusy}
              >
                プレミアム鑑定 980円
              </button>
            </div>
            {checkoutError && <p className="error-text">{checkoutError}</p>}
          </div>
        )}

        {fortunePlan && (
          <div className={`message fortune-result ${fortunePlan === "premium" ? "fortune-premium" : "fortune-detail"}`}>
            <span
              className={
                fortunePlan === "premium" ? "plan-label plan-label-crown" : "plan-label"
              }
            >
              {fortunePlan === "premium" ? "Premium" : "Detail"}
            </span>
            <h3>{fortunePlan === "premium" ? "プレミアム鑑定結果" : "詳細鑑定結果"}</h3>
            {!fortuneResult ? (
              <p>鑑定結果を作成しています🔮</p>
            ) : (
              <>
                <p>{fortuneResult.summary}</p>
                <section className="fortune-section">
                  <h4>相手の本音</h4>
                  <p>{fortuneResult.partnerFeelings}</p>
                </section>
                <section className="fortune-section">
                  <h4>2人の今後の流れ</h4>
                  <p>{fortuneResult.futureFlow}</p>
                </section>
                <section className="fortune-section">
                  <h4>今送るべきLINE</h4>
                  {fortuneResult.lineMessages.map((line) => (
                    <div className="line-card" key={line}>
                      {line}
                    </div>
                  ))}
                </section>
                <section className="fortune-section warning">
                  <h4>やってはいけない行動</h4>
                  <ul>
                    {fortuneResult.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </section>
                <section className="fortune-section">
                  <h4>3日以内に取るべき行動</h4>
                  <ol className="action-list">
                    {fortuneResult.actionPlan.map((action) => (
                      <li key={action}>{action}</li>
                    ))}
                  </ol>
                </section>
                {fortunePlan === "detail" && (
                  <section ref={premiumUpsellCardRef} className="fortune-section premium-upsell-cta">
                    <h4>プレミアム鑑定の差分を足す</h4>
                    <p>
                      LINE文の<strong>別パターン</strong>と、頭の中を整理する<strong>1週間の行動プラン</strong>
                      まで欲しい方は、いまの相談のまま追加できます。
                    </p>
                    <p className="premium-upsell-price">
                      追加 <strong>480円</strong>（税込・単発）※詳細鑑定のあとなら差額分
                    </p>
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => void startCheckout("premium", { upgradeFrom: "detail" })}
                      disabled={chatBusy}
                    >
                      プレミアムに広げる
                    </button>
                    {checkoutError && <p className="error-text">{checkoutError}</p>}
                  </section>
                )}
                {fortunePlan === "premium" && fortuneResult.premiumPlan && (
                  <section className="fortune-section premium-extra">
                    <h4>1週間の行動プラン</h4>
                    <ol className="action-list">
                      {fortuneResult.premiumPlan.map((action) => (
                        <li key={action}>{action}</li>
                      ))}
                    </ol>
                  </section>
                )}
                {resultConsultationId && (
                  <section className="fortune-section">
                    <h4>あとから見返す</h4>
                    <p>この鑑定結果は保存済みです。ページを閉じても、下のリンクから再表示できます🌙</p>
                    <a
                      className="secondary-button"
                      href={
                        consultationSessionToken
                          ? `/result/${resultConsultationId}?plan=${fortunePlan}&session=${encodeURIComponent(consultationSessionToken)}`
                          : `/result/${resultConsultationId}?plan=${fortunePlan}`
                      }
                    >
                      鑑定結果ページを開く
                    </a>
                  </section>
                )}
              </>
            )}
          </div>
        )}

        <form className="chat-form" onSubmit={handleSubmit}>
          <textarea
            ref={chatInputRef}
            rows={2}
            placeholder={paidMode ? "鑑定結果について、追加で聞きたいことを書いてください" : "相手との関係や、今いちばん知りたいことを書いてください"}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            disabled={chatBusy || (showPaywall && !paidMode)}
          />
          <button className="primary-button chat-send-button" type="submit" disabled={chatBusy || (showPaywall && !paidMode)}>
            送信
          </button>
        </form>
      </section>

      <section className="pricing-section" id="pricing">
        <div className="section-title-row">
          <div>
            <h2>無料相談のあとに、もっと深く鑑定できます</h2>
            <p>相手の本音、今送るLINE、次に取る行動まで具体化します。</p>
            <p className="pricing-extra-note">
              詳細鑑定お済みの方は、チャット内の鑑定結果から<strong>差額480円</strong>でプレミアムに広げられます。
            </p>
          </div>
          <span className="pricing-badge">単発課金</span>
        </div>
        <div className="pricing-grid">
          <article className="pricing-card pricing-card-detail">
            <span className="plan-label">まず試すなら</span>
            <h3>詳細鑑定</h3>
            <strong className="pricing-price">500円</strong>
            <ul>
              <li>相手の本音</li>
              <li>今後の流れ</li>
              <li>今送るべきLINE</li>
              <li>3日以内の行動</li>
            </ul>
          </article>
          <article className="pricing-card pricing-card-premium">
            <span className="plan-label plan-label-crown">最上位</span>
            <h3>プレミアム鑑定</h3>
            <strong className="pricing-price">980円</strong>
            <ul>
              <li>詳細鑑定の内容</li>
              <li>LINE返信文3パターン</li>
              <li>1週間の行動プラン</li>
              <li>鑑定後の追加相談</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="faq-section">
        <h2>よくある質問</h2>
        <div className="faq-list">
          <details>
            <summary>無料相談だけでも使えますか？</summary>
            <p>はい。登録なしで3往復まで相談できます。まずは今の状況を整理したい時にも使えます。</p>
          </details>
          <details>
            <summary>有料鑑定では何が増えますか？</summary>
            <p>相手の本音、今後の流れ、今送るべきLINE、やってはいけない行動、3日以内の行動まで具体的に見られます。</p>
          </details>
          <details>
            <summary>プレミアム鑑定は誰向けですか？</summary>
            <p>復縁や告白前、既読無視など、失敗したくない相談向けです。LINE文3パターンと1週間の行動プランまで出します。</p>
          </details>
          <details>
            <summary>詳細鑑定からプレミアムへ足すことはできますか？</summary>
            <p>
              はい。詳細鑑定のあと、同じ相談のままプレミアム鑑定の差分（LINE文の追加案・1週間プランなど）だけを
              <strong>480円</strong>で追加できます。チャット内の鑑定結果に表示されるボタンからお進みください。
            </p>
          </details>
          <details>
            <summary>決済方法や請求はどうなりますか？</summary>
            <p>
              クレジットカード等は Stripe 経由で処理されます。都度購入のみで、サブスクリプションではありません。
            </p>
          </details>
          <details>
            <summary>占い結果は絶対ですか？</summary>
            <p>絶対ではありません。恋愛の流れを整理し、次の行動を考えるための参考として使ってください。</p>
          </details>
        </div>
      </section>
    </main>
  );
}
