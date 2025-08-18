import * as vscode from 'vscode';
import { DisposableStore } from './platform/disposable-store';
import { Settings } from './platform/settings';
import { initializeAnalyzer } from './features/analyzer';

let globalSettings: Settings;
let lastActiveMarkdownEditor: vscode.TextEditor | undefined;

/**
 * 拡張機能のアクティベーション
 * 最小限の初期化のみ行い、重い処理は遅延ロードする
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('[CriticalWritingJp] Activating extension...');
  
  // 初期アクティブエディタを設定
  if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.languageId === 'markdown') {
    lastActiveMarkdownEditor = vscode.window.activeTextEditor;
  }

  const startTime = Date.now();
  const store = new DisposableStore();
  context.subscriptions.push(store);

  try {
    // Step 1: Initialize global settings first
    console.log('[CriticalWritingJp] Step 1: Initializing global settings');
    globalSettings = new Settings();
    console.log('[CriticalWritingJp] Global settings initialized successfully');

    // Step 2: Register all commands IMMEDIATELY (synchronously)
    console.log('[CriticalWritingJp] Step 2: Registering commands');
    registerCommands(store, context);
    console.log('[CriticalWritingJp] All commands registered successfully');

    // Step 3: Register document handlers
    console.log('[CriticalWritingJp] Step 3: Registering document handlers');
    registerTextDocumentHandlers(store, context);
    console.log('[CriticalWritingJp] Document handlers registered successfully');

    // Step 4: Heavy initialization happens AFTER command registration
    setTimeout(async () => {
      console.log('[CriticalWritingJp] Step 4: Starting analyzer initialization (async)');
      try {
        await initializeAnalyzer(context);
        console.log('[CriticalWritingJp] Analyzer initialized successfully');
      } catch (error) {
        console.error('[CriticalWritingJp] Failed to initialize analyzer:', error);
        // アナライザー初期化失敗は警告のみ（拡張機能は基本機能で動作継続）
        vscode.window.showWarningMessage('一部の解析機能が無効になっています');
      }
    }, 100);

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
        try {
          const mod = await import('./features/panel');
          await mod.createOrShowPanel(context);
        } catch (errPrimary) {
          console.warn('[CriticalWritingJp] Failed to load ./features/panel, trying fallback ./features/webview-panel', errPrimary);
          try {
            const modFallback = await import('./features/webview-panel');
            await modFallback.createOrShowPanel(context);
          } catch (errFallback) {
            console.error('[CriticalWritingJp] Failed to load both panel modules', { errPrimary, errFallback });
            throw errFallback;
          }
        }
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
      if (!lastActiveMarkdownEditor || lastActiveMarkdownEditor.document.isClosed) {
        vscode.window.showWarningMessage('Markdownファイルを開いてください');
        return;
      }

      vscode.window.showInformationMessage('キーワード解析を実行中...');
      // 実際の解析処理は遅延ロード
      const { runAnalysis } = await import('./features/analyzer');
      await runAnalysis(lastActiveMarkdownEditor.document);

      // パネルの表示を更新
      const { updatePanel } = await import('./features/panel');
      await updatePanel();

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
      lastActiveMarkdownEditor = editor;

      // 新しいMarkdownファイルが開かれた時の初期解析
      const { runAnalysis } = await import('./features/analyzer');
      await runAnalysis(editor.document);

      // Markdownファイルが開かれた時に自動的にパネルを表示
      try {
        const mod = await import('./features/panel');
        await mod.createOrShowPanel(context);
      } catch (errPrimary) {
        console.warn('[CriticalWritingJp] Failed to load ./features/panel on editor change, trying fallback ./features/webview-panel', errPrimary);
        try {
          const modFallback = await import('./features/webview-panel');
          await modFallback.createOrShowPanel(context);
        } catch (errFallback) {
          console.warn('[CriticalWritingJp] Failed to auto-open panel with both modules', { errPrimary, errFallback });
        }
      }
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