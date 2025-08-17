import * as vscode from 'vscode';
import { DisposableStore } from './platform/disposable-store';
import { Settings } from './platform/settings';
import { initializeAnalyzer } from './features/analyzer';

let globalSettings: Settings;

/**
 * 拡張機能のアクティベーション
 * 最小限の初期化のみ行い、重い処理は遅延ロードする
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('[CriticalWritingJp] Activating extension...');
  
  const startTime = Date.now();
  const store = new DisposableStore();
  context.subscriptions.push(store);

  // グローバル設定インスタンスを初期化
  globalSettings = new Settings();

  // アナライザーを初期化（エンジン統合）
  initializeAnalyzer(context);

  try {
    // 基本コマンドの登録（遅延ロード）
    registerCommands(store, context);

    // Markdown言語でのテキスト変更監視の登録
    registerTextDocumentHandlers(store, context);

    // 設定変更監視
    store.add(globalSettings.onDidChange((newSettings) => {
      console.log('[CriticalWritingJp] Settings changed');
      globalSettings = newSettings;
    }));

    const activationTime = Date.now() - startTime;
    console.log(`[CriticalWritingJp] Extension activated in ${activationTime}ms`);
    
    // アクティベーション時間の閾値を定数として抽出（リファクタリング：Extract Variable）
    const ACTIVATION_TIME_THRESHOLD_MS = 50;
    
    // アクティベーション時間が閾値以上の場合は警告
    if (activationTime > ACTIVATION_TIME_THRESHOLD_MS) {
      console.warn(`[CriticalWritingJp] Activation time (${activationTime}ms) exceeded target (${ACTIVATION_TIME_THRESHOLD_MS}ms)`);
    }

  } catch (error) {
    console.error('[CriticalWritingJp] Failed to activate extension:', error);
    vscode.window.showErrorMessage('CriticalWritingJp拡張機能の初期化に失敗しました');
    throw error;
  }
}

/**
 * 拡張機能の非アクティベーション
 * DisposableStoreが自動的にリソースをクリーンアップする
 */
export function deactivate() {
  console.log('[CriticalWritingJp] Deactivating extension...');
  // context.subscriptions に登録されたDisposableStoreが自動的に破棄される
}

/**
 * コマンドハンドラーのエラー処理テンプレート（リファクタリング：Replace Template Method）
 */
function withErrorHandling(
  commandHandler: () => Promise<void>,
  errorContext: string,
  userErrorMessage: string
): () => Promise<void> {
  return async () => {
    try {
      await commandHandler();
    } catch (error) {
      console.error(`[CriticalWritingJp] ${errorContext}:`, error);
      vscode.window.showErrorMessage(userErrorMessage);
    }
  };
}

/**
 * パネル表示/非表示トグルコマンドの登録（リファクタリング：Extract Function）
 */
function registerTogglePanelCommand(store: DisposableStore, context: vscode.ExtensionContext) {
  store.add(vscode.commands.registerCommand('criticalWritingJp.togglePanel', 
    withErrorHandling(
      async () => {
        // 初回実行時のみWebviewパネル機能を動的ロード
        const { createOrShowPanel } = await import('./features/panel');
        await createOrShowPanel(context);
      },
      'Failed to toggle panel',
      'パネルの表示に失敗しました'
    )
  ));
}

/**
 * LLM機能有効化コマンドの登録（リファクタリング：Extract Function）
 */
function registerEnableLLMCommand(store: DisposableStore) {
  store.add(vscode.commands.registerCommand('criticalWritingJp.enableLLM', async () => {
    try {
      const result = await vscode.window.showInformationMessage(
        'LLM機能を有効にすると、文書の内容がローカルのAIモデルで解析されます。この機能を有効にしますか？',
        { modal: true },
        '有効にする'
      );
      
      if (result === '有効にする') {
        await globalSettings.updateSetting('llm.enabled', true);
        vscode.window.showInformationMessage('LLM機能を有効化しました');
      }
    } catch (error) {
      console.error('[CriticalWritingJp] Failed to enable LLM:', error);
      vscode.window.showErrorMessage('LLM機能の有効化に失敗しました');
    }
  }));
}

/**
 * Google Books APIキー設定コマンドの登録（リファクタリング：Extract Function）
 */
function registerConfigureGoogleBooksKeyCommand(store: DisposableStore, context: vscode.ExtensionContext) {
  store.add(vscode.commands.registerCommand('criticalWritingJp.configureGoogleBooksKey', async () => {
    try {
      const apiKey = await vscode.window.showInputBox({
        prompt: 'Google Books APIキーを入力してください',
        password: true,
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'APIキーを入力してください';
          }
          return undefined;
        }
      });

      if (apiKey) {
        // SecretStorageに保存
        await context.secrets.store('googleBooksApiKey', apiKey.trim());
        vscode.window.showInformationMessage('Google Books APIキーを保存しました');
      }
    } catch (error) {
      console.error('[CriticalWritingJp] Failed to configure Google Books API key:', error);
      vscode.window.showErrorMessage('APIキーの設定に失敗しました');
    }
  }));
}

/**
 * キーワード解析即時実行コマンドの登録（リファクタリング：Extract Function）
 */
function registerRunKeywordNowCommand(store: DisposableStore) {
  store.add(vscode.commands.registerCommand('criticalWritingJp.runKeywordNow', async () => {
    try {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== 'markdown') {
        vscode.window.showWarningMessage('Markdownファイルを開いてください');
        return;
      }

      vscode.window.showInformationMessage('キーワード解析を実行中...');
      // 実際の解析処理は遅延ロード
      const { runAnalysis } = await import('./features/analyzer');
      await runAnalysis(editor.document);
      vscode.window.showInformationMessage('キーワード解析が完了しました');
    } catch (error) {
      console.error('[CriticalWritingJp] Failed to run keyword analysis:', error);
      vscode.window.showErrorMessage('キーワード解析に失敗しました');
    }
  }));
}

/**
 * 引用スタイル検証コマンドの登録（リファクタリング：Extract Function）
 */
function registerValidateCitationStyleCommand(store: DisposableStore) {
  store.add(vscode.commands.registerCommand('criticalWritingJp.validateCitationStyle', async () => {
    try {
      vscode.window.showInformationMessage('引用スタイル検証は将来のバージョンで実装予定です');
    } catch (error) {
      console.error('[CriticalWritingJp] Failed to validate citation style:', error);
      vscode.window.showErrorMessage('引用スタイル検証に失敗しました');
    }
  }));
}

/**
 * スタイル問題修正コマンドの登録（リファクタリング：Extract Function）
 */
function registerFixStyleIssuesCommand(store: DisposableStore) {
  store.add(vscode.commands.registerCommand('criticalWritingJp.fixStyleIssues', async () => {
    try {
      vscode.window.showInformationMessage('スタイル修正機能は将来のバージョンで実装予定です');
    } catch (error) {
      console.error('[CriticalWritingJp] Failed to fix style issues:', error);
      vscode.window.showErrorMessage('スタイル修正に失敗しました');
    }
  }));
}

/**
 * コマンドの登録（遅延ロード）
 */
function registerCommands(store: DisposableStore, context: vscode.ExtensionContext) {
  registerTogglePanelCommand(store, context);
  registerEnableLLMCommand(store);
  registerConfigureGoogleBooksKeyCommand(store, context);
  registerRunKeywordNowCommand(store);
  registerValidateCitationStyleCommand(store);
  registerFixStyleIssuesCommand(store);
}

/**
 * テキストドキュメントのハンドラ登録
 */
function registerTextDocumentHandlers(store: DisposableStore, context: vscode.ExtensionContext) {
  // Markdownファイルのテキスト変更監視
  store.add(vscode.workspace.onDidChangeTextDocument(async (event) => {
    try {
      if (event.document.languageId !== 'markdown') {
        return;
      }

      // デバウンス処理は analyzer モジュール内で実装
      // ここでは変更イベントのみを伝播
      const { handleTextChange } = await import('./features/analyzer');
      await handleTextChange(event);
    } catch (error) {
      // テキスト変更処理のエラーはログに記録するが、ユーザーには通知しない
      console.warn('[CriticalWritingJp] Error in text change handler:', error);
    }
  }));

  // アクティブエディタ変更監視
  store.add(vscode.window.onDidChangeActiveTextEditor(async (editor) => {
    try {
      if (!editor || editor.document.languageId !== 'markdown') {
        return;
      }

      // 新しいMarkdownファイルが開かれた時の初期解析
      const { runAnalysis } = await import('./features/analyzer');
      await runAnalysis(editor.document);

      // Markdownファイルが開かれた時に自動的にパネルを表示
      const { createOrShowPanel } = await import('./features/panel');
      await createOrShowPanel(context);
    } catch (error) {
      console.warn('[CriticalWritingJp] Error in active editor change handler:', error);
    }
  }));
}

/**
 * 現在の設定を取得
 */
export function getSettings(): Settings {
  return globalSettings;
}