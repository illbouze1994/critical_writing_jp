# CriticalWritingJp 開発者向けドキュメント

## 概要

CriticalWritingJpは、日本語学術・技術文書の執筆支援を行うVS Code拡張機能です。Markdownドキュメントの段落解析、文字数カウント、重要度算出、引用チェックなど、質の高い文書作成をサポートします。

## 開発環境のセットアップ

### 必要な環境

- **Node.js**: 18.x 以上
- **npm**: 9.x 以上
- **VS Code**: 1.103.0 以上
- **Git**: 最新版

### プロジェクトのクローンと依存関係のインストール

```bash
# プロジェクトのクローン
git clone <repository-url>
cd critical_writing_jp

# 依存関係のインストール
npm install
```

## ビルド方法

### 開発用ビルド

開発中はソースマップ付きでビルドし、デバッグを容易にします：

```bash
# 開発用ビルド（ソースマップ付き）
npm run build:dev

# ウォッチモード（ファイル変更時に自動ビルド）
npm run watch
```

### 本番用ビルド

リリース用は最適化されたビルドを実行します：

```bash
# 本番用ビルド（最適化・縮小化）
npm run build
```

### ビルド設定

- **バンドルツール**: ESBuild
- **ターゲット**: Node.js 18
- **出力先**: `dist/extension.js`
- **外部依存**: `vscode` モジュールは除外
- **最適化**: 本番では minify 及び tree-shaking を適用

## ローカル開発とテスト

### 拡張機能の動作確認

1. **VS Codeでプロジェクトを開く**
   ```bash
   code .
   ```

2. **ビルドを実行**
   ```bash
   npm run build:dev
   ```

3. **拡張機能のデバッグ実行**
   - `F5`キーを押すか、「実行とデバッグ」パネルから「Run Extension」を実行
   - 新しいVS Codeウィンドウ（Extension Development Host）が開きます

4. **機能テスト**
   - 新しいウィンドウでMarkdownファイルを作成・編集
   - コマンドパレット（`Ctrl+Shift+P`）から拡張機能のコマンドを実行

### 主なコマンド

| コマンド | 機能 |
|---------|------|
| `CriticalWritingJp: Toggle Panel` | 解析パネルの表示/非表示切替 |
| `CriticalWritingJp: Re-Analyze Now` | 即時再解析の実行 |
| `CriticalWritingJp: Enable LLM (Consent)` | LLM機能の有効化（同意必須） |
| `CriticalWritingJp: Configure Google Books API Key` | Google Books APIキーの設定 |

### 設定項目

VS Code設定（`Ctrl+,`）で「criticalWritingJp」を検索し、以下の項目を調整できます：

- **文字数閾値**: 段落の最小・最大文字数
- **キーワード抽出モード**: rules/tfidf/embed
- **ROI重み係数**: 重要度計算の重み
- **パフォーマンス設定**: 最大ワーカー数など

## 開発時のデバッグ

### ログの確認

1. **VS Code出力パネル**
   - `Ctrl+Shift+U` → 「CriticalWritingJp」を選択
   - 拡張機能のログメッセージを確認

2. **開発者コンソール**
   - `Ctrl+Shift+I` で開発者ツールを開く
   - Consoleタブでランタイムログを確認

### ブレークポイント設定

1. ソースコード（`src/`以下）にブレークポイントを設定
2. `F5`でデバッグ実行
3. 拡張機能を操作してブレークポイントで停止

## テスト方法

### 単体テスト

```bash
# 全テストの実行
npm test

# カバレッジ付きテスト実行
npm run test:unit

# テストカバレッジレポートの生成
npm run test:coverage

# ウォッチモードでテスト実行
npm run test:watch
```

### ⚠️ 重要：拡張機能の正しいテスト方法

**❌ 間違った方法：**
```bash
# これは動作しません！
node .\dist\extension.js
# エラー: Cannot find module 'vscode'
```

**✅ 正しい方法：**
1. VS Codeでプロジェクトを開く
2. `F5`キーを押して Extension Development Host を起動
3. 新しいVS Codeウィンドウで拡張機能をテスト

VS Code拡張機能は特別なランタイム環境（Extension Host）で動作するため、通常のNode.jsでは実行できません。

### 手動テスト手順

1. **基本機能テスト**
   ```markdown
   # テスト文書の例
   
   ## 見出し1
   この段落は200文字未満の短い段落です。文字数カウント機能のテストに使用します。
   
   ## 見出し2
   この段落は800文字を超える長い段落のテストです。Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.
   ```

2. **テスト観点**
   - 段落の正しい検出
   - 文字数カウントの精度
   - 閾値超過/不足時のハイライト
   - パネルの表示・更新
   - 段落へのジャンプ機能

## パッケージング

### .vsix ファイルの作成

```bash
# VSCEのインストール（初回のみ）
npm install -g vsce

# パッケージの作成
vsce package
```

### ローカルインストール

```bash
# .vsixファイルからインストール（バージョンは現在のpackage.jsonに合わせる）
code --install-extension critical-writing-jp-1.0.1.vsix

# 既存バージョンがインストール済みの場合は先にアンインストール
code --uninstall-extension illbouze.critical-writing-jp

# 強制的に再インストール
code --install-extension critical-writing-jp-1.0.1.vsix --force
```

### 完全なビルドと導入手順

パネルの無限拡張バグなどの修正を確実に反映するため、以下の手順で完全なビルドと導入を行ってください：

```bash
# 1. 依存関係のクリーンインストール
Remove-Item node_modules -Recurse -Force -ErrorAction SilentlyContinue
npm install

# 2. webview-uiの依存関係もクリーンインストール
cd webview-ui
Remove-Item node_modules -Recurse -Force -ErrorAction SilentlyContinue
npm install
cd ..

# 3. 完全なビルド実行
npm run build

# 4. .vsixパッケージの作成
npx vsce package

# 5. VS Codeでの既存拡張機能のアンインストール（重要）
code --uninstall-extension illbouze.critical-writing-jp

# 6. VS Codeを完全に再起動

# 7. 新しいパッケージのインストール
code --install-extension critical-writing-jp-1.0.1.vsix --force
```

## プロジェクト構造

```
src/
├── core/                    # コア機能（VS Code非依存）
│   ├── types.ts            # 型定義
│   └── utils.ts            # ユーティリティ関数
├── platform/               # VS Code API依存の薄い層
│   ├── disposable-store.ts # リソース管理
│   └── settings.ts         # 設定管理
├── features/               # 機能単位のモジュール
│   ├── analyzer.ts         # 段落解析
│   └── panel.ts           # Webviewパネル
└── extension.ts            # エントリポイント

scripts/
└── build.js               # ビルドスクリプト
```

## コーディング規約

### TypeScript設定

- **strict モード**を有効化
- **型安全性**を最優先
- **any型**の使用は最小限に

### パフォーマンス指標

- **アクティベーション時間**: < 50ms
- **UI応答時間**: < 200ms (p95)
- **初期メモリ使用量**: < 80MB
- **バンドルサイズ**: < 2MB

### エラーハンドリング

- すべての非同期処理にエラーハンドリングを実装
- ユーザー向けエラーメッセージは日本語で表示
- 開発者向けログは英語で詳細情報を記録

## 将来の拡張予定

- **キーワード抽出**: TF-IDF、埋め込みベース手法
- **LLM評価**: ローカルWASMモデルによる文体・論証評価
- **Google Books API**: 書誌情報の照合・補完
- **引用スタイルチェック**: 学会形式への準拠チェック
- **スタイル辞書**: カスタム用語・表現ルール

## トラブルシューティング

### よくある問題

1. **ビルドエラー**
   - `node_modules`を削除して`npm install`を再実行
   - Node.jsバージョンを確認（18.x以上必要）

2. **拡張機能が動作しない**
   - VS Codeを再起動
   - 出力パネルでエラーログを確認

3. **パネルの無限縦方向拡張バグ**
   - 症状：文字種バランス・常用漢字使用率パネルが縦に無限に拡張される
   - 原因：古いキャッシュされたwebview UIが使用されている
   - 解決方法：
     ```bash
     # 完全なアンインストールと再インストール
     code --uninstall-extension illbouze.critical-writing-jp
     # VS Codeを完全に再起動
     code --install-extension critical-writing-jp-1.0.1.vsix --force
     ```
   - 予防策：開発時は必ずwebview UIも含めた完全ビルドを実行する

4. **パフォーマンス問題**
   - 設定で最大ワーカー数を調整
   - 大きな文書では部分解析を利用

### ログレベル設定

開発時は詳細ログを有効化：

```json
{
  "criticalWritingJp.debug.enabled": true,
  "criticalWritingJp.debug.logLevel": "verbose"
}
```

## 貢献方法

1. **イシューの報告**: GitHubのIssuesで問題を報告
2. **機能提案**: Discussionsで新機能を提案
3. **プルリクエスト**: 機能追加・バグ修正のコントリビューション

---

**開発者向け注意事項**

- セキュリティ要件: デフォルトは完全オフライン動作
- プライバシー保護: ユーザー同意なしの外部通信禁止
- 低スペック対応: 2コア/8GB環境での快適動作を保証