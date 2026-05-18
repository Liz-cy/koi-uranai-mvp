/** 表示用の運営者情報（特商法・問い合わせ）。本番は .env で上書きしてください。 */

export function getSiteDisplayName() {
  return process.env.NEXT_PUBLIC_SITE_NAME?.trim() || "恋占いチャット";
}

export function getOperatorName() {
  return process.env.NEXT_PUBLIC_OPERATOR_NAME?.trim() || "（運営者名：.env の NEXT_PUBLIC_OPERATOR_NAME を設定してください）";
}

export function getContactEmail() {
  return process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "";
}

/** 問い合わせフォームの宛先（公開用メールとは分けたい場合は CONTACT_INBOX を使う） */
export function getContactInboxEmail() {
  const direct = process.env.CONTACT_INBOX?.trim();
  if (direct) return direct;
  return getContactEmail();
}

export function getOperatorAddress() {
  return process.env.NEXT_PUBLIC_OPERATOR_ADDRESS?.trim() || "";
}
