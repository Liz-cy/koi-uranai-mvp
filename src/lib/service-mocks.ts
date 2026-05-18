/**
 * 本番相当の環境では、Stripe / OpenAI 未設定時にモックで成功レスポンスを返さない。
 *
 * - Vercel 本番: VERCEL_ENV === "production" のとき有効
 * - それ以外のホスト: DISABLE_SERVICE_MOCKS=true で有効
 * - 障害時の緊急のみ: ALLOW_SERVICE_MOCKS=true で無効化（非推奨）
 */
export function areServiceMocksDisabled(): boolean {
  if (process.env.ALLOW_SERVICE_MOCKS === "true") return false;
  if (process.env.DISABLE_SERVICE_MOCKS === "true") return true;
  if (process.env.VERCEL_ENV === "production") return true;
  return false;
}
