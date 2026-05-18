"use client";

import { FormEvent, useState } from "react";

const CATEGORIES = [
  { value: "payment", label: "決済・料金" },
  { value: "fortune", label: "鑑定・内容" },
  { value: "bug", label: "不具合・エラー" },
  { value: "other", label: "その他" },
] as const;

export function SupportForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const honeypot = (fd.get("website") as string)?.trim();
    if (honeypot) {
      setStatus("ok");
      setMessage("送信しました。");
      return;
    }

    setStatus("loading");
    setMessage("");

    const payload = {
      email: (fd.get("email") as string)?.trim(),
      name: (fd.get("name") as string)?.trim() || undefined,
      category: fd.get("category") as string,
      body: (fd.get("body") as string)?.trim(),
    };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;

      if (!res.ok) {
        setStatus("err");
        setMessage(data?.error || "送信に失敗しました。時間をおいて再度お試しください。");
        return;
      }
      setStatus("ok");
      setMessage("送信しました。追ってご連絡できる場合はメールをご確認ください。");
      form.reset();
    } catch {
      setStatus("err");
      setMessage("送信に失敗しました。ネットワークをご確認ください。");
    }
  }

  return (
    <form className="support-form" onSubmit={onSubmit}>
      <label className="support-label">
        <span>メールアドレス（必須）</span>
        <input className="support-input" type="email" name="email" required autoComplete="email" maxLength={254} />
      </label>
      <label className="support-label">
        <span>お名前（任意）</span>
        <input className="support-input" type="text" name="name" autoComplete="name" maxLength={80} />
      </label>
      <label className="support-label">
        <span>種別</span>
        <select className="support-input" name="category" required defaultValue="other">
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="support-label">
        <span>内容（10〜4000文字）</span>
        <textarea className="support-textarea" name="body" required minLength={10} maxLength={4000} rows={8} />
      </label>
      <div className="support-honeypot" aria-hidden="true">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <button className="primary-button" type="submit" disabled={status === "loading"}>
        {status === "loading" ? "送信中…" : "送信する"}
      </button>
      {message ? <p className={`support-message ${status === "err" ? "support-message-err" : ""}`}>{message}</p> : null}
    </form>
  );
}
