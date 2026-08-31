# シフト管理システム

複数店舗にまたがるスタッフのシフト管理と、店舗ごとの営業カレンダーを一元管理するWebシステム。確定したシフトは店舗ごとのGoogle共有カレンダーへ自動反映される（システム→Googleの片方向同期）。

## 技術スタック

- Next.js (App Router) + TypeScript
- PostgreSQL + Prisma 6
- NextAuth.js v5（Googleログイン、`staff`テーブルに登録済みのメールアドレスのみ許可）
- Google Calendar API（サービスアカウント方式）

## テーブル構成

- `stores` — 店舗マスタ
- `store_business_calendars` — 店舗別営業カレンダー（日単位の営業/休業・時間）
- `staff` — スタッフマスタ
- `staff_store_assignments` — スタッフの所属可能店舗（多対多）
- `shifts` — シフト
- `google_calendar_syncs` — シフトとGoogleカレンダーイベントの同期状態

詳細は [`prisma/schema.prisma`](prisma/schema.prisma) を参照。

## セットアップ

### 1. PostgreSQLの用意

Dockerが使える場合:

```bash
docker compose up -d
```

Dockerが使えない場合は、ローカルにPostgreSQLをインストールし、`.env`の`DATABASE_URL`を接続先に合わせて書き換える。

### 2. 依存パッケージのインストール

```bash
npm install
```

### 3. 環境変数の設定

`.env`（すでに`.env.example`から作成済み）を編集する。

- `DATABASE_URL`: PostgreSQL接続文字列
- `AUTH_SECRET`: `npx auth secret` で生成
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`: [Google Cloud Console](https://console.cloud.google.com/apis/credentials) でOAuthクライアントIDを作成して取得。承認済みリダイレクトURIに `http://localhost:3000/api/auth/callback/google` を追加する
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`: Googleカレンダー連携用のサービスアカウント（下記参照）
- `SEED_ADMIN_EMAIL`: 初回ログインを許可する管理者のGoogleアカウントのメールアドレス

### 4. マイグレーションとシード

```bash
npx prisma migrate dev
npx prisma db seed
```

`SEED_ADMIN_EMAIL`で指定したメールアドレスの管理者スタッフが登録される。ログインはこのメールアドレスのGoogleアカウントで行う。

### 5. 開発サーバー起動

```bash
npm run dev
```

http://localhost:3000 にアクセスし、Googleアカウントでログインする。

## Googleカレンダー連携の設定

1. Google Cloud Consoleでサービスアカウントを作成し、JSON鍵をダウンロード
2. `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` に鍵の内容を設定
3. 各店舗のGoogleカレンダーの共有設定で、サービスアカウントのメールアドレスに「予定の変更権限」を付与
4. `stores`テーブルの該当店舗の`googleCalendarId`にカレンダーIDを設定（店舗管理API `PATCH /api/stores/:id` で更新、またはGoogleカレンダーの設定画面からカレンダーIDをコピーして直接登録）

シフトのステータスを`CONFIRMED`にすると、対象店舗のカレンダーへイベントが作成・更新される。`CANCELLED`にする、またはシフトを削除するとカレンダー側のイベントも削除される。同期結果は`google_calendar_syncs`テーブルに記録される（失敗してもシフト自体の登録・更新は成功として扱われる）。

## API概要

すべて `/api/*` はログイン必須。作成・更新・削除は`ADMIN`または`STORE_MANAGER`ロールのみ許可。

| Method | Path | 用途 |
| --- | --- | --- |
| GET/POST | `/api/stores` | 店舗一覧・作成 |
| GET/PATCH/DELETE | `/api/stores/:id` | 店舗の参照・更新・削除 |
| GET/POST | `/api/staff` | スタッフ一覧・作成 |
| GET/PATCH/DELETE | `/api/staff/:id` | スタッフの参照・更新・無効化 |
| GET/POST | `/api/business-calendar?storeId=&from=&to=` | 営業カレンダーの参照・登録（upsert） |
| GET/POST | `/api/shifts?storeId=&staffId=&from=&to=` | シフト一覧（期間必須）・登録 |
| GET/PATCH/DELETE | `/api/shifts/:id` | シフトの参照・更新・削除 |

## 現状のスコープと今後の拡張候補

現在は「管理者がシフトを直接確定登録する」運用を前提とした最小構成。トップページは本日のシフト一覧を表示する簡易ダッシュボードのみで、店舗・スタッフ・シフトの登録/編集フォームはAPI経由での操作が前提（管理画面UIは未実装）。

- 管理画面UI（店舗・スタッフ・シフトのCRUD画面、月間カレンダー表示）
- スタッフ希望シフト（`shift_requests`）と承認ワークフロー
- Googleカレンダーからの逆方向同期（現状はシステム→Googleの片方向のみ）
- ロール・権限のきめ細かい制御（店舗ごとの管理範囲の制限など）
