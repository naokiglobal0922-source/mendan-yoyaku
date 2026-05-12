# 面談予約×名簿管理アプリ

塾の面談予約をGoogle Sheetsと連携して管理するWebアプリです。

## 機能

- **保護者向け（/）**: 週単位カレンダーで空き枠確認・予約
- **管理者向け（/admin）**: 予約一覧・名簿管理・面談済み記録

## 技術スタック

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Google Sheets API v4
- LINE Messaging API

## セットアップ

### 1. Google Service Account の準備

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
2. Google Sheets API を有効化
3. サービスアカウントを作成し、JSONキーをダウンロード
4. スプレッドシートをサービスアカウントのメールアドレスに共有（編集権限）

```bash
# JSONキーをBase64エンコード
cat service-account.json | base64
```

### 2. スプレッドシート構造

**「2026」シート:**
- A列: 日付（例: 4/1, 4/2 ...）
- B列: 曜日
- C列以降: 時間帯ヘッダー（8:00, 8:30, 9:00 ... 22:00, 22:30）

**「面談記録シート」:**
- A列: 生徒名（1行目はヘッダー）
- B列: 面談済みフラグ（「済」）
- C列: 面談日付

### 3. 環境変数（.env.local）

```
GOOGLE_SERVICE_ACCOUNT_KEY=  # base64エンコードしたService Account JSON
SPREADSHEET_ID=1MdowjWSMPlFtoi-4yy9ajpWCHQ1K-hqabPZCAbu-KIY
LINE_CHANNEL_ACCESS_TOKEN=   # LINE Messaging API のアクセストークン
LINE_USER_ID=                # 通知先のLINEユーザーID（塾長）
ADMIN_PASSWORD=              # 管理者パスワード（任意の文字列）
```

### 4. ローカル起動

```bash
npm install
npm run dev
```

## GitHub → Vercel デプロイ手順

### GitHubにプッシュ

```bash
# gh CLIを使う場合
gh repo create mendan-yoyaku --public --source=. --push

# または手動
git remote add origin https://github.com/ユーザー名/mendan-yoyaku.git
git push -u origin main
```

### Vercelにデプロイ

1. [Vercel](https://vercel.com/) にログイン
2. 「Add New Project」→ GitHubリポジトリを選択
3. 「Environment Variables」に以下を追加:
   - `GOOGLE_SERVICE_ACCOUNT_KEY`
   - `SPREADSHEET_ID`
   - `LINE_CHANNEL_ACCESS_TOKEN`
   - `LINE_USER_ID`
   - `ADMIN_PASSWORD`
4. 「Deploy」をクリック

### 以後の更新

```bash
git add .
git commit -m "update"
git push
# Vercelが自動でデプロイ
```

## LINE通知の設定

1. [LINE Developers](https://developers.line.biz/) でチャネルを作成（Messaging API）
2. チャネルアクセストークンを発行 → `LINE_CHANNEL_ACCESS_TOKEN`
3. 塾長のLINEユーザーIDを取得 → `LINE_USER_ID`
   - Webhook受信イベントの `source.userId` から取得するのが確実
