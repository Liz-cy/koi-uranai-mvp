import { Resend } from "resend";
import { getSiteDisplayName } from "@/lib/site-identity";

const resendFrom = process.env.RESEND_FROM?.trim();

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildPurchaseEmailBodies(payload: { planLabel: string; amountYen: number | null }) {
  const site = getSiteDisplayName();
  const safeLabel = escapeHtml(payload.planLabel);
  const safeSite = escapeHtml(site);
  const amountLine =
    typeof payload.amountYen === "number" && payload.amountYen > 0
      ? `お支払い金額: ${payload.amountYen.toLocaleString("ja-JP")}円（税込）\n`
      : "";

  const text = `このたびは「${payload.planLabel}」をお申し込みいただきありがとうございます。

${amountLine}
サイトに戻り、鑑定結果をご確認ください。

---
${site}
`;

  const amountHtml =
    typeof payload.amountYen === "number" && payload.amountYen > 0
      ? `<p style="margin:16px 0;font-size:15px;color:#2d2938;">お支払い金額: <strong>${payload.amountYen.toLocaleString("ja-JP")}円</strong>（税込）</p>`
      : "";

  const html = `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f7f2ff;font-family:'Yu Gothic',Meiryo,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f2ff;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:20px;border:1px solid #e7ddfa;overflow:hidden;">
          <tr>
            <td style="padding:28px 24px 8px;">
              <p style="margin:0;font-size:13px;color:#8f7ae5;font-weight:700;">${safeSite}</p>
              <h1 style="margin:12px 0 0;font-size:18px;color:#211a45;line-height:1.5;">お支払いありがとうございます</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 24px;">
              <p style="margin:0 0 12px;font-size:15px;color:#2d2938;line-height:1.7;">
                このたびは「<strong>${safeLabel}</strong>」をお申し込みいただきありがとうございます。
              </p>
              ${amountHtml}
              <p style="margin:20px 0 0;font-size:14px;color:#746d86;line-height:1.65;">
                サイトに戻り、鑑定結果をご確認ください。
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { text, html };
}

export async function sendPurchaseThankYouEmail(
  to: string,
  payload: { planLabel: string; amountYen: number | null },
): Promise<{ ok: boolean; skippedReason?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, skippedReason: "RESEND_API_KEY unset" };
  }
  if (!resendFrom) {
    return { ok: false, skippedReason: "RESEND_FROM unset" };
  }

  const resend = new Resend(apiKey);
  const { text, html } = buildPurchaseEmailBodies(payload);

  const { error } = await resend.emails.send({
    from: resendFrom,
    to: [to],
    subject: `【${getSiteDisplayName()}】お支払いありがとうございます（${payload.planLabel}）`,
    text,
    html,
  });

  if (error) {
    console.error("Resend send error", error);
    return { ok: false, skippedReason: error.message };
  }

  return { ok: true };
}

export async function sendContactFormEmail(payload: {
  to: string;
  replyTo: string;
  categoryLabel: string;
  userName?: string;
  message: string;
}): Promise<{ ok: boolean; skippedReason?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, skippedReason: "RESEND_API_KEY unset" };
  }
  if (!resendFrom) {
    return { ok: false, skippedReason: "RESEND_FROM unset" };
  }

  const site = getSiteDisplayName();
  const who = payload.userName ? `${payload.userName}（${payload.replyTo}）` : payload.replyTo;
  const text = `【お問い合わせフォーム】
サイト: ${site}
種別: ${payload.categoryLabel}
送信者: ${who}

--- メッセージ ---
${payload.message}
`;

  const safe = (s: string) => escapeHtml(s).replace(/\n/g, "<br/>");
  const html = `<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;line-height:1.65;color:#2d2938;">
  <p><strong>【お問い合わせ】${escapeHtml(site)}</strong></p>
  <p>種別: ${escapeHtml(payload.categoryLabel)}<br/>送信者: ${safe(who)}</p>
  <hr style="border:none;border-top:1px solid #e7ddfa;margin:16px 0"/>
  <p>${safe(payload.message)}</p>
</body></html>`;

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: resendFrom,
    to: [payload.to],
    replyTo: payload.replyTo,
    subject: `【${site}】お問い合わせ（${payload.categoryLabel}）`,
    text,
    html,
  });

  if (error) {
    console.error("Resend contact form error", error);
    return { ok: false, skippedReason: error.message };
  }

  return { ok: true };
}
