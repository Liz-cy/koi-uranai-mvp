import { createHmac, timingSafeEqual } from "node:crypto";

type Payload = {
  sub: string;
  exp: number;
};

export function isConsultationSessionEnforced(): boolean {
  return Boolean(process.env.CONSULTATION_SESSION_SECRET?.trim());
}

export function createConsultationSessionToken(consultationId: string): string | null {
  const secret = process.env.CONSULTATION_SESSION_SECRET?.trim();
  if (!secret) return null;

  const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  const payloadJson = JSON.stringify({ sub: consultationId, exp } satisfies Payload);
  const payloadB64 = Buffer.from(payloadJson, "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(payloadB64).digest();
  const sigB64 = sig.toString("base64url");

  return `v1.${payloadB64}.${sigB64}`;
}

export function verifyConsultationSessionToken(token: string | null | undefined, consultationId: string): boolean {
  const secret = process.env.CONSULTATION_SESSION_SECRET?.trim();
  if (!secret) return true;

  if (!token || typeof token !== "string") return false;

  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;

  const [, payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return false;

  const expectedSig = createHmac("sha256", secret).update(payloadB64).digest();
  let sig: Buffer;
  try {
    sig = Buffer.from(sigB64, "base64url");
  } catch {
    return false;
  }
  if (sig.length !== expectedSig.length || !timingSafeEqual(sig, expectedSig)) return false;

  let payload: Payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as Payload;
  } catch {
    return false;
  }

  if (typeof payload.sub !== "string" || payload.sub !== consultationId) return false;
  if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return false;

  return true;
}
