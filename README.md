# 恋占いチャット MVP

恋愛相談AI占いチャットのNext.js版MVPです。

静的プロトタイプを本番化するための土台として、以下を入れています。

- トップページ
- チャットUI
- 無料3往復制限
- 詳細鑑定 / プレミアム鑑定の仮導線
- `/api/chat` のAI相談API（`OPENAI_API_KEY` 未設定時はローカル用モック。本番ではキー必須）

## 起動方法

1. **PostgreSQL を起動する**（例: 同梱の Docker Compose）

```bash
docker compose up -d
```

2. **環境変数** `.env.local` を `.env.example` を参考に用意し、`DATABASE_URL` を Postgres の接続文字列にする（Compose 既定は `.env.example` と同じユーザー名／DB 名）。

3. **マイグレーション**（初回・スキーマ変更後）

```bash
npm install
npm run db:migrate
npm run dev
```

ブラウザで開く:

```text
http://localhost:3000
```

※ 以前 SQLite（`file:./dev.db`）のみだった頃のデータは **自動移行されません**。Postgres は空の DB に `migrate` して使い始めてください。

### 作業を再開するとき

1. このフォルダ（`koi-uranai-mvp`）を Cursor で開く  
2. ターミナルで `npm run dev`（初回だけ `npm install`）  
3. `.env.local` に API / **`DATABASE_URL`（`postgresql://…` 形式）** / `STRIPE_*` などが入っているか確認（旧 SQLite の `file:./dev.db` のままだとマイグレーションとアプリが失敗します）  

公開URLは `NEXT_PUBLIC_APP_URL` です。`robots.txt` / `sitemap.xml` はその値をベースに出します（未設定時は `http://localhost:3000`）。トップの `link rel="canonical"` はこのベースURLに結合されます。OGP / X（Twitter）向けのシェア画像は `opengraph-image` / `twitter-image`（Noto Sans JP を Edge から取得）で生成します。`manifest.ts` で簡易 Web App Manifest（インストール名・アイコン）を出します。

Search Console / Bing の所有権確認用トークンは `GOOGLE_SITE_VERIFICATION` / `BING_SITE_VERIFICATION`（任意）を設定すると `meta` に出力されます。

## デプロイ（Vercel例）

1. GitHub 等にリポジトリを置き、Vercelでプロジェクトをインポートする  
2. 環境変数に **`OPENAI_API_KEY`**・**`STRIPE_SECRET_KEY`**・**`STRIPE_WEBHOOK_SECRET`**・**`NEXT_PUBLIC_APP_URL`**（本番の `https://` URL）・**`DATABASE_URL`**・**`CONSULTATION_SESSION_SECRET`**（十分な長さのランダム文字列）・**`ADMIN_TOKEN`** を入れる（Vercel の **Production** 向け。`VERCEL_ENV=production` のとき、キー未設定だとチャット／決済／鑑定APIは **503** でモック成功しません）

自前サーバーなど **Vercel 以外** で本番運用する場合は、追加で **`DISABLE_SERVICE_MOCKS=true`** を入れると、同様にモック無効化の挙動になります（**`ALLOW_SERVICE_MOCKS=true`** で緊急時のみモックを許可。非推奨）。
3. ビルドは既定の `npm run build` でよい（**ビルド時に** `prisma migrate deploy` が走り、本番 DB に未適用マイグレーションがあれば適用する。Vercel では **`DATABASE_URL` をビルド環境にも渡す**必要がある）  
4. Stripe Webhook URL を `https://あなたのドメイン/api/stripe/webhook` に合わせる  

詳細は Vercel / Stripe / DB プロバイダのドキュメントに従ってください。

## AI接続

**本番（Vercel Production または `DISABLE_SERVICE_MOCKS=true`）では `OPENAI_API_KEY` が必須**です。未設定の `/api/chat`・`/api/fortune` は **503**、OpenAI エラー時は **502**（モックや定型フォールバックで成功扱いにしません）。プレビュー環境やローカルではキーが無い場合のみ従来どおりモック返答・鑑定モックが使えます。

`.env.example` を `.env.local` にコピーして、APIキーを入れます。

```text
OPENAI_API_KEY=your_api_key
OPENAI_MODEL=gpt-4o-mini
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
DATABASE_URL="postgresql://koiuranai:koiuranai@localhost:5432/koiuranai?schema=public"
ADMIN_TOKEN=your_admin_token
CONSULTATION_SESSION_SECRET=long_random_string_at_least_32_chars
CHAT_RATE_LIMIT_PER_MINUTE=40
NEXT_PUBLIC_GA_MEASUREMENT_ID=
STRIPE_FIRST_PURCHASE_PROMOTION_CODE_ID=
```

`CONSULTATION_SESSION_SECRET` を設定すると、相談IDだけでは鑑定取得・履歴保存・再開ができず、サーバーが発行したセッショントークンが必要になります。未設定のままでは従来どおりローカル検証向けに緩い動作です。

## Stripe決済

`STRIPE_SECRET_KEY` が未設定の場合は、**開発・Preview 等**で鑑定ボタンが **モック成功**（決済画面を経ず鑑定が開く）になります。**Vercel Production** または **`DISABLE_SERVICE_MOCKS=true`** ではこのモックは使われず、**503** を返します。

`STRIPE_SECRET_KEY` を設定すると、`/api/checkout` がStripe Checkout Sessionを作成します。

Stripe Webhookの受け口:

```text
/api/stripe/webhook
```

Webhook Secretを `STRIPE_WEBHOOK_SECRET` に設定すると、署名付きイベントを検証できます。

本番の Webhook では次のイベントを購読することを推奨します。

- `checkout.session.completed`（通常の即時決済）
- `checkout.session.async_payment_succeeded`（コンビニ・銀行振込など遅延支払いが完了したとき）

`payment_status` が `unpaid` の `checkout.session.completed` はDBを `paid` にしないため、遅延決済は上記 async イベントで追いつきます。

初期プラン:

- 詳細鑑定: 500円
- プレミアム鑑定: 980円
- **詳細鑑定の後のプレミアム差分**: 480円（`upgradeFrom: "detail"` を付けてチェックアウトするとサーバーが詳細鑑定の支払い済みを確認してから課金します）

Checkout では、**自動適用プロモが付かないセッション**に限り **`allow_promotion_codes`** により手入力クーポン欄を出します。Stripeダッシュボード側でクーポン・プロモーションコードを作成してください。

### 初回購入プロモ（任意）

`STRIPE_FIRST_PURCHASE_PROMOTION_CODE_ID` に **プロモーションコードID**（`promo_...`、ダッシュボードのプロモーションコード詳細で確認）を設定すると、フロントが送る `applyFirstPurchasePromo` が真のとき、**その相談IDで `paid` 済みが1件もない場合だけ** Checkout にそのコードを自動適用します（プレミアム差額アップグレードでは適用しません）。

同一ユーザーの「生涯初回」までは Stripe 側のクーポン条件（例: 利用回数上限）で縛るか、運用で調整してください。

決済へ進む直前に、現在の相談履歴をDBとブラウザのlocalStorageへ保存します。Stripeから戻った後は、まずDBの支払い状態と相談履歴を確認してから鑑定結果を生成します。

Checkout Sessionには `consultationId` を metadata として渡し、成功URLには `session_id` も付けます。Webhook側でも `consultationId` を受け取り、支払い完了時にDBを `paid` に更新します。

決済復帰API（成功URLから呼び出し・Webhookが遅いときのフォールバック）:

```text
POST /api/checkout/restore
```

## アクセス解析（GA4・任意）

`NEXT_PUBLIC_GA_MEASUREMENT_ID` に **G- で始まる測定ID** を入れると、トップの `<head>` 相当で gtag を読み込み、次を送信します。

- `begin_checkout` … Stripe へリダイレクトする直前（値段はカタログ価格）
- `purchase` … 決済成功でトップに戻ったあと **復帰APIで取得した `amountTotal` 優先**（クーポン適用後の実額に近い）。`sessionStorage` で同一 `transaction_id` の二重送信を防ぎます。

GA4 のデバッグビューと、本番の `NEXT_PUBLIC_APP_URL`（https の絶対URL）の整合を確認してください。

### Cookie 同意（任意）

`NEXT_PUBLIC_GA_CONSENT_REQUIRED=true` のときだけ、画面下部にバナーを表示し、**同意した場合のみ** Google Analytics のタグを読み込みます。未設定（既定）ではバナーなしで、これまでどおり計測します（国内のみの運用でシンプルにしたい場合は設定しないでください）。

## エラー監視（Sentry・任意）

- **DSN**: `NEXT_PUBLIC_SENTRY_DSN`（クライアント）と `SENTRY_DSN`（サーバー・未設定ならクライアントと同じでも可）  
- **ソースマップ**: CI でアップロードする場合は `SENTRY_ORG`・`SENTRY_PROJECT` を入れると `next.config.ts` が `withSentryConfig` を有効化します。**未設定でも** `instrumentation` によりランタイムのエラー送信は試せます。  

`src/instrumentation.ts` / `instrumentation-client.ts` / `sentry.*.config.ts` / `app/global-error.tsx` を利用しています。

## 決済サンクスメール（Resend・任意）

`RESEND_API_KEY` と送信元メール `RESEND_FROM`（Resend で認証済みのドメイン、または検証用の `onboarding@resend.dev` など）を設定すると、Stripe Webhook で支払い完了を受けたあと、チェックアウト時のメールアドレス宛に**テキスト＋HTML**のサンクスメールを送ります。未設定のときは送信をスキップしてログのみとします。件名・本文のサイト名は `NEXT_PUBLIC_SITE_NAME`（未設定時は「恋占いチャット」）を使います。

`/support` のお問い合わせフォームも同じ Resend 設定で送れます。宛先は `CONTACT_INBOX`（任意・未設定なら `NEXT_PUBLIC_CONTACT_EMAIL`）。フォーム送信は IP 単位で時間あたり回数を制限します（`CONTACT_RATE_LIMIT_PER_HOUR`、既定 8）。

## LINE 公式（任意）

`NEXT_PUBLIC_LINE_OFFICIAL_URL` に LINE の友だち追加URL等を入れると、サイト下部にリンクを表示します。

## DB

Prisma + **PostgreSQL** で、相談履歴と決済状態を保存します。ローカルでは `docker compose up -d` で DB を立ち上げ、`.env.local` の `DATABASE_URL` を合わせてください（`npm run dev` や `npm run build` の前に DB が起動していること）。

```bash
npm run db:migrate
npm run db:generate
```

保存する主なデータ:

- `Consultation`: 相談ID、相談履歴、無料相談回数、選択プラン、初回チェックアウト時のUTM（`utmSource` / `utmMedium` / `utmCampaign`）
- `Payment`: Stripe Session ID、相談ID、プラン、支払い状態、金額
- `FortuneResult`: 相談ID、プラン、鑑定結果JSON、生成元

支払い済みの相談では、追加チャットのやり取りが返信のたびに `Consultation.messagesJson` へ保存されます（`POST /api/consultation/messages`）。

## 相談セッション（本番推奨）

`CONSULTATION_SESSION_SECRET` を設定すると、次のAPIで **相談IDに紐づくHMACセッション** が必須になります（有効期限7日）。

- `POST /api/fortune`（`consultationId` 指定時）
- `POST /api/consultation/messages`
- `POST /api/consultation/resume`
- `GET /api/fortune/result`（クエリ `session`）
- `/result/[consultationId]`（クエリ `session`）

決済開始・復帰・再開のレスポンスに含まれる `sessionToken` を、フロントが保持してリクエストに載せます。

## 管理画面

相談数、決済数、売上、保存済み鑑定数を確認できます。

```text
/admin?token=your_admin_token
```

`ADMIN_TOKEN` とURLの `token` が一致しない場合は表示されません。

支払い済み（`status: paid`）の一覧をCSVで取得するAPI（同じトークンで保護）:

```text
/api/admin/export?token=your_admin_token
```

## UTM（流入計測）

ランディングURLに `utm_source`・`utm_medium`・`utm_campaign` が付いている場合、**初めて検知したときだけ**ブラウザの `localStorage` に保存します。決済ボタン押下時に `/api/checkout` へ送り、相談レコードの初回作成時に `Consultation` に保存します（既存レコードの更新では上書きしません）。

## チャットAPIのレート制限

`CHAT_RATE_LIMIT_PER_MINUTE` で同一IPあたりの `/api/chat` 呼び出し回数（1分窓）を調整できます。実装はプロセス内メモリのため、**サーバーレスでインスタンスが増えると実効上限も分割**されます。厳密な制限にはRedis等が必要です。

## 有料鑑定生成

`/api/fortune` が詳細鑑定・プレミアム鑑定の結果を生成します。

`OPENAI_API_KEY` が設定されている場合はAI生成、未設定の場合はモック鑑定で動きます。

`consultationId` が渡された場合は、支払い済み状態を確認してから鑑定結果をDBに保存します。
同じ相談ID・同じプランの鑑定結果がすでにある場合は、再生成せず保存済みの結果を返します。

保存済み鑑定結果の取得API:

```text
/api/fortune/result?consultationId=...&plan=detail&session=...
```

鑑定結果ページ:

```text
/result/[consultationId]?plan=detail&session=...
```

鑑定結果ページからチャットへ戻る（支払い済み・同じプランの相談を復元）:

```text
/?continue=1&consultation_id=...&plan=detail&session=...
```

内部API:

```text
POST /api/consultation/resume
POST /api/consultation/messages
```

`/api/fortune` の返却内容:

- 鑑定まとめ
- 相手の本音
- 2人の今後の流れ
- LINE返信文
- NG行動
- 3日以内の行動
- プレミアム用の1週間プラン

その他:

- `GET /api/health`: DB 疎通確認（JSON `{ ok, db }`）。監視・ロードバランサのヘルスチェック向け
- `POST /api/contact`: お問い合わせフォーム（Resend。宛先は `CONTACT_INBOX` または `NEXT_PUBLIC_CONTACT_EMAIL`。`CONTACT_RATE_LIMIT_PER_HOUR` で IP あたりの時間窓上限）

## 次にやること（プロダクトまわりは一通り揃えた想定）

あとは**集客・プロモーション**が中心です（広告・SNS・SEO記事・インフルエンサー・コミュニティ露出など）。運用で不足が出たら個別に足してください。

- **プロダクト外の例**: メール・LINE の定期配信、CRM連携、独自のヘルプセンター/CMS など

## 主なファイル

- `src/app/page.tsx`: 画面とチャットUI
- `src/app/legal/privacy/page.tsx`: プライバシーポリシー（雛形・事業者情報は env で差し替え）
- `src/app/legal/tokusho/page.tsx`: 特定商取引法に基づく表記（料金は `PRICING_JPY` と同期）
- `src/app/legal/terms/page.tsx`: 利用規約（雛形）
- `src/app/support/page.tsx`: お問い合わせ
- `src/app/not-found.tsx`: 404
- `src/components/SiteFooter.tsx`: フッター（法的リンク・LINE）
- `src/lib/site-identity.ts`: サイト名・運営者表示の共通ヘルパ
- `src/app/sitemap.ts`: sitemap.xml（主要ページ）
- `src/app/admin/page.tsx`: 管理画面
- `src/app/result/[consultationId]/page.tsx`: 保存済み鑑定結果ページ
- `src/app/api/chat/route.ts`: AI相談API
- `src/app/api/fortune/route.ts`: 有料鑑定生成API
- `src/app/api/consultation/resume/route.ts`: 鑑定後のチャット再開API
- `src/app/api/consultation/messages/route.ts`: 相談履歴の追記保存API
- `src/app/api/fortune/result/route.ts`: 保存済み鑑定結果取得API
- `src/app/api/contact/route.ts`: お問い合わせ受付 API
- `src/app/api/health/route.ts`: DB ヘルスチェック
- `src/app/api/checkout/restore/route.ts`: 決済復帰時のDB復元API
- `src/app/api/stripe/webhook/route.ts`: Stripe Webhook受信API
- `src/app/globals.css`: UIスタイル
- `prisma/schema.prisma`: 相談・決済DBスキーマ（PostgreSQL）
- `docker-compose.yml`: ローカルPostgres
- `src/lib/og-share-image.tsx`: OGP・Twitter 用シェア画像の描画（`next/og`）
- `src/lib/analytics.ts`: GA4 イベント（purchase / begin_checkout）
- `src/components/CookieConsentBar.tsx`: GA 用 Cookie 同意バナー（`NEXT_PUBLIC_GA_CONSENT_REQUIRED`）
- `src/lib/cookie-consent.ts`: 同意状態（localStorage）
- `src/lib/email.ts`: Resend 経由のサンクスメール（任意）
- `src/instrumentation.ts` / `instrumentation-client.ts`: Sentry・Next 計装
- `src/sentry.server.config.ts` / `src/sentry.edge.config.ts`: Sentry 初期化
- `src/app/global-error.tsx`: ルート例外の捕捉とユーザー向け表示
- `src/lib/prisma.ts`: Prisma Client共有設定
