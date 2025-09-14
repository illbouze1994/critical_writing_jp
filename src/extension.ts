import * as vscode from 'vscode';
import { DisposableStore } from './platform/disposable-store';
import { Settings } from './platform/settings';
import { initializeAnalyzer, disposeAnalyzer } from './features/analyzer';

let globalSettings: Settings;
let lastActiveMarkdownEditor: vscode.TextEditor | undefined;
let extensionDisposables: DisposableStore | undefined;

/**
 * 拡張機能のアクティベーション
 * 最小限の初期化のみ行い、重い処理は遅延ロードする
 */
export function activate(context: vscode.ExtensionContext) {
  // 開発中のリロード時に古いリソースが残らないように、最初にクリーンアップする
  if (extensionDisposables) {
    extensionDisposables.dispose();
  }
  extensionDisposables = new DisposableStore();
  context.subscriptions.push(extensionDisposables);

  console.log('[CriticalWritingJp] Activating extension...');
  
  // 初期アクティブエディタを設定
  if (vscode.window.activeTextEditor) {
    const lang = vscode.window.activeTextEditor.document.languageId;
    if (lang === 'markdown' || lang === 'plaintext') {
      lastActiveMarkdownEditor = vscode.window.activeTextEditor;
    }
  }

  const startTime = Date.now();

  try {
    // Step 1: Initialize global settings first
    console.log('[CriticalWritingJp] Step 1: Initializing global settings');
    globalSettings = new Settings();
    console.log('[CriticalWritingJp] Global settings initialized successfully');

    // Step 2: Register all commands IMMEDIATELY (synchronously)
    console.log('[CriticalWritingJp] Step 2: Registering commands');
    registerCommands(extensionDisposables, context);
    console.log('[CriticalWritingJp] All commands registered successfully');

    // Step 3: Register document handlers
    console.log('[CriticalWritingJp] Step 3: Registering document handlers');
    registerTextDocumentHandlers(extensionDisposables, context);
    console.log('[CriticalWritingJp] Document handlers registered successfully');

    // Step 4: Heavy initialization happens AFTER command registration
    setTimeout(async () => {
      console.log('[CriticalWritingJp] Step 4: Starting analyzer initialization (async)');
      try {
        // アナライザーに DisposableStore を渡して、管理対象のリソースを登録させる
        await initializeAnalyzer(context, extensionDisposables);
        console.log('[CriticalWritingJp] Analyzer initialized successfully');

        // 初期状態でMarkdownエディタが開かれている場合は解析を実行
        const editor = vscode.window.activeTextEditor;
        if (editor && (editor.document.languageId === 'markdown' || editor.document.languageId === 'plaintext') && !editor.document.isClosed) {
          lastActiveMarkdownEditor = editor;
          const { runAnalysis } = await import('./features/analyzer');
          await runAnalysis(editor.document);

          // The new panel doesn't have an `updatePanel` export, but we can get the instance
          // and call a method on it if we expose one. For now, let's assume showing it is enough.
        }

        // VSCode起動時にパネルを自動表示（横に表示しフォーカスは保持）
        try {
          const { createOrShowPanel } = await import('./features/webview-panel');
          await createOrShowPanel(context);
        } catch (e) {
          console.warn('[CriticalWritingJp] Failed to auto-open panel on startup:', e);
        }
      } catch (error) {
        console.error('[CriticalWritingJp] Failed to initialize analyzer:', error);
        // アナライザー初期化失敗は警告のみ（拡張機能は基本機能で動作継続）
        vscode.window.showWarningMessage('一部の解析機能が無効になっています');
      }
    }, 100);

    // 設定変更監視
    extensionDisposables.add(globalSettings.onDidChange((newSettings) => {
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
    
    // 部分的な初期化失敗でも拡張機能を完全に停止させない
    // コマンド登録の競合エラーの場合は警告のみ
    if (error instanceof Error && error.message.includes('already exists')) {
      console.warn('[CriticalWritingJp] Some commands already registered by another instance, continuing with partial functionality');
      vscode.window.showWarningMessage('CriticalWritingJp: 一部機能が他のインスタンスと競合しています');
    } else {
      vscode.window.showErrorMessage('CriticalWritingJp拡張機能の初期化に失敗しました');
      
      // 重大なエラーの場合のみリソースをクリーンアップ
      if (extensionDisposables) {
        try {
          extensionDisposables.dispose();
        } catch (disposeError) {
          console.warn('[CriticalWritingJp] Error during cleanup:', disposeError);
        }
      }
      throw error;
    }
  }
}

/**
 * 拡張機能の非アクティベーション
 * DisposableStoreが自動的にリソースをクリーンアップする
 */
export function deactivate() {
  console.log('[CriticalWritingJp] Deactivating extension...');
  if (extensionDisposables) {
    extensionDisposables.dispose();
    extensionDisposables = undefined;
  }
  disposeAnalyzer(); // アナライザー内のリソースも破棄
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
  try {
    store.add(vscode.commands.registerCommand('criticalWritingJp.togglePanel', 
      withErrorHandling(
        async () => {
          // 初回実行時のみWebviewパネル機能を動的ロード（フォールバックは使用しない）
          const mod = await import('./features/webview-panel');
          await mod.createOrShowPanel(context);
        },
        'Failed to toggle panel',
        'パネルの表示に失敗しました'
      )
    ));
  } catch (error) {
    console.warn('[CriticalWritingJp] Command already registered: criticalWritingJp.togglePanel');
  }
}

/**
 * LLM機能有効化コマンドの登録（リファクタリング：Extract Function）
 */
function registerEnableLLMCommand(store: DisposableStore) {
  try {
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
  } catch (error) {
    console.warn('[CriticalWritingJp] Command already registered: criticalWritingJp.enableLLM');
  }
}

/**
 * Google Books APIキー設定コマンドの登録（リファクタリング：Extract Function）
 */
function registerConfigureGoogleBooksKeyCommand(store: DisposableStore, context: vscode.ExtensionContext) {
  try {
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
  } catch (error) {
    console.warn('[CriticalWritingJp] Command already registered: criticalWritingJp.configureGoogleBooksKey');
  }
}

/**
 * キーワード解析即時実行コマンドの登録（リファクタリング：Extract Function）
 */
function registerRunKeywordNowCommand(store: DisposableStore) {
  try {
    store.add(vscode.commands.registerCommand('criticalWritingJp.runKeywordNow', async () => {
      try {
        const editor = vscode.window.activeTextEditor;
        if (!editor || (editor.document.languageId !== 'markdown' && editor.document.languageId !== 'plaintext') || editor.document.isClosed) {
          vscode.window.showWarningMessage('Markdownかtxtファイルを開いてください');
          return;
        }

        vscode.window.showInformationMessage('キーワード解析を実行中...');
        // 実際の解析処理は遅延ロード
        const { runAnalysis } = await import('./features/analyzer');
        await runAnalysis(editor.document);

        // The new panel doesn't have an `updatePanel` export.
        // The analysis result is now automatically sent to the panel by the analyzer.
        // So this call is no longer needed.

        vscode.window.showInformationMessage('キーワード解析が完了しました');
      } catch (error) {
        console.error('[CriticalWritingJp] Failed to run keyword analysis:', error);
        vscode.window.showErrorMessage('キーワード解析に失敗しました');
      }
    }));
  } catch (error) {
    console.warn('[CriticalWritingJp] Command already registered: criticalWritingJp.runKeywordNow');
  }
}

/**
 * 引用スタイル検証コマンドの登録（リファクタリング：Extract Function）
 */
function registerValidateCitationStyleCommand(store: DisposableStore) {
  try {
    store.add(vscode.commands.registerCommand('criticalWritingJp.validateCitationStyle', async () => {
      try {
        vscode.window.showInformationMessage('引用スタイル検証は将来のバージョンで実装予定です');
      } catch (error) {
        console.error('[CriticalWritingJp] Failed to validate citation style:', error);
        vscode.window.showErrorMessage('引用スタイル検証に失敗しました');
      }
    }));
  } catch (error) {
    console.warn('[CriticalWritingJp] Command already registered: criticalWritingJp.validateCitationStyle');
  }
}

/**
 * スタイル問題修正コマンドの登録（リファクタリング：Extract Function）
 */
function registerFixStyleIssuesCommand(store: DisposableStore) {
  try {
    store.add(vscode.commands.registerCommand('criticalWritingJp.fixStyleIssues', async () => {
      try {
        vscode.window.showInformationMessage('スタイル修正機能は将来のバージョンで実装予定です');
      } catch (error) {
        console.error('[CriticalWritingJp] Failed to fix style issues:', error);
        vscode.window.showErrorMessage('スタイル修正に失敗しました');
      }
    }));
  } catch (error) {
    console.warn('[CriticalWritingJp] Command already registered: criticalWritingJp.fixStyleIssues');
  }
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

  // 新しいコマンドを登録
  try {
    store.add(vscode.commands.registerCommand('criticalWritingJp.jumpToParagraphAndShowPanel', async (range: {start: number, end: number}) => {
      try {
        // パネルを表示
        const { createOrShowPanel } = await import('./features/webview-panel');
        await createOrShowPanel(context);

        // 指定された範囲にジャンプ
        const editor = vscode.window.activeTextEditor;
        if (editor && range) {
          const startPos = editor.document.positionAt(range.start);
          const endPos = editor.document.positionAt(range.end);
          editor.selection = new vscode.Selection(startPos, endPos);
          editor.revealRange(new vscode.Range(startPos, endPos), vscode.TextEditorRevealType.InCenter);
        }
      } catch (error) {
        console.error('[CriticalWritingJp] Failed to jump to paragraph:', error);
        vscode.window.showErrorMessage('指定段落へのジャンプに失敗しました');
      }
    }));
  } catch (error) {
    console.warn('[CriticalWritingJp] Command already registered: criticalWritingJp.jumpToParagraphAndShowPanel');
  }
}

/**
 * テキストドキュメントのハンドラ登録
 */
function registerTextDocumentHandlers(store: DisposableStore, context: vscode.ExtensionContext) {
  // サポート対象言語のファイル変更を監視
  store.add(vscode.workspace.onDidChangeTextDocument(async (event) => {
    try {
      const lang = event.document.languageId;
      if (lang !== 'markdown' && lang !== 'plaintext') {
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

  // ドキュメント閉じられた時の処理
  store.add(vscode.workspace.onDidCloseTextDocument(async (document) => {
    try {
      const lang = document.languageId;
      if (lang !== 'markdown' && lang !== 'plaintext') {
        return;
      }

      // 解析キャッシュをクリア
      const { clearAnalysisCache } = await import('./features/analyzer');
      clearAnalysisCache(document.uri.toString());

      // The new panel will receive an empty update message, so this is not needed.
    } catch (error) {
      console.warn('[CriticalWritingJp] Error in document close handler:', error);
    }
  }));

  // アクティブエディタ変更監視
  store.add(vscode.window.onDidChangeActiveTextEditor(async (editor) => {
    try {
      if (!editor) return;
      const lang = editor.document.languageId;
      if (lang !== 'markdown' && lang !== 'plaintext') {
        return;
      }
      lastActiveMarkdownEditor = editor;

      // パネルを表示
      const { createOrShowPanel } = await import('./features/webview-panel');
      await createOrShowPanel(context);

      // 新しいファイルが開かれた時の初期解析
      const { runAnalysis } = await import('./features/analyzer');
      await runAnalysis(editor.document);
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