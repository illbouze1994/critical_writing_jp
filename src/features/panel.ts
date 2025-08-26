import * as vscode from 'vscode';
import { AnalysisResult } from '../core/types';
import { getCachedAnalysisResult, getLastAnalyzedUri, runAnalysis, runAnalysisForUri } from './analyzer';
import { TextAnalyzer } from '../core/text-analyzer';

let currentPanel: vscode.WebviewPanel | undefined;
let keywordHighlightEnabled = false; // キーワードハイライト機能の状態（デフォルトはOFF）
let extensionContext: vscode.ExtensionContext | undefined;

/**
 * パネルを作成または表示
 * @param context 拡張機能のコンテキスト
 */
export async function createOrShowPanel(context: vscode.ExtensionContext): Promise<void> {
  // Store the extension context for later use
  extensionContext = context;
  
  const columnToShowIn = vscode.window.activeTextEditor
    ? vscode.window.activeTextEditor.viewColumn
    : undefined;

  if (currentPanel) {
    // 既存のパネルをサイドに表示（エディタのフォーカスは維持）
    try {
      currentPanel.reveal(vscode.ViewColumn.Beside, true);
    } catch {}
    await updatePanelContent();
    return;
  }

  // 新しいパネルを作成
  currentPanel = vscode.window.createWebviewPanel(
    'criticalWritingJp.panel',
    'CriticalWritingJp',
    { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, 'webview')
      ]
    }
  );

  // パネルのHTMLコンテンツを設定
  currentPanel.webview.html = getWebviewContent(currentPanel.webview);

  // 表示状態の変更で再描画（移動や表示時）
  currentPanel.onDidChangeViewState(() => {
    if (currentPanel && currentPanel.visible) {
      updatePanelContent();
    }
  }, null, context.subscriptions);

  // パネルが破棄されたときの処理
  currentPanel.onDidDispose(() => {
    currentPanel = undefined;
  }, null, context.subscriptions);

  // メッセージハンドリング
  currentPanel.webview.onDidReceiveMessage(
    async (message) => {
      await handleWebviewMessage(message);
    },
    undefined,
    context.subscriptions
  );

  // 初回コンテンツ更新
  await updatePanelContent();
}

/**
 * パネルのコンテンツを更新
 */
async function updatePanelContent(): Promise<void> {
  if (!currentPanel) {
    return;
  }

  // 対象ドキュメントURIを解決（アクティブMD → 可視MD → 最終解析URI）
  let targetUri: string | undefined;
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor && (activeEditor.document.languageId === 'markdown' || activeEditor.document.languageId === 'plaintext')) {
    targetUri = activeEditor.document.uri.toString();
  }
  if (!targetUri) {
    const visibleMd = vscode.window.visibleTextEditors.find(e => e.document.languageId === 'markdown' || e.document.languageId === 'plaintext');
    if (visibleMd) {
      targetUri = visibleMd.document.uri.toString();
    }
  }
  if (!targetUri) {
    targetUri = getLastAnalyzedUri();
  }

  if (!targetUri) {
    // 対象ドキュメントなし
    try {
      currentPanel.webview.postMessage({
        type: 'update',
        payload: {
          hasContent: false,
          message: 'txtファイルかMarkdownファイルを開いてください'
        }
      });
    } catch {}
    return;
  }

  let result = getCachedAnalysisResult(targetUri);
  if (!result || !Array.isArray((result as any).paragraphs)) {
    // Proactively run analysis if possible, then retry once
    try {
      const active = vscode.window.activeTextEditor;
      if (active && (active.document.languageId === 'markdown' || active.document.languageId === 'plaintext')) {
        await runAnalysis(active.document);
      } else {
        // Try visible editor
        const visibleMd = vscode.window.visibleTextEditors.find(e => e.document.languageId === 'markdown' || e.document.languageId === 'plaintext');
        if (visibleMd) {
          await runAnalysis(visibleMd.document);
        } else if (targetUri) {
          await runAnalysisForUri(targetUri);
        }
      }
    } catch (e) {
      console.warn('[Panel] Background analysis trigger failed:', e);
    }

    // Retry fetching
    result = getCachedAnalysisResult(targetUri);
    if (!result || !Array.isArray((result as any).paragraphs)) {
      try {
        currentPanel.webview.postMessage({
          type: 'update',
          payload: {
            hasContent: false,
            message: '解析中...'
          }
        });
      } catch {}
      return;
    }
  }

  // 解析結果をWebviewに送信
  const payload = createPanelPayload(result);
  try {
    currentPanel.webview.postMessage({
      type: 'update',
      payload
    });
  } catch {}
}


/**
 * キーワードハイライト機能の状態を取得
 * @returns キーワードハイライトが有効かどうか
 */
export function isKeywordHighlightEnabled(): boolean {
  return keywordHighlightEnabled;
}

/**
 * パネル表示用のデータを作成
 * @param result 解析結果
 * @returns パネル表示用データ
 */
function createPanelPayload(result: AnalysisResult) {
  const totalParagraphs = result.paragraphs.length;
  const totalChars = result.paragraphs.reduce((sum, p) => sum + p.chars, 0);
  
  const config = vscode.workspace.getConfiguration('criticalWritingJp');
  const minThreshold = config.get<number>('counting.threshold.min', 200);
  const maxThreshold = config.get<number>('counting.threshold.max', 800);
  const previewLen = config.get<number>('ui.preview.headChars', 40);
  
  const overCount = result.paragraphs.filter(p => p.chars > maxThreshold).length;
  const underCount = result.paragraphs.filter(p => p.chars < minThreshold).length;

  // Rows for the paragraph list expected by the webview script
  const rows = result.paragraphs.map(p => {
    const preview = (p.text || '').replace(/\s+/g, ' ').slice(0, Math.max(0, previewLen));
    const status = p.chars > maxThreshold ? 'over' : (p.chars < minThreshold ? 'under' : 'normal');
    return {
      id: p.id,
      range: { start: p.range.start, end: p.range.end },
      preview,
      chars: p.chars,
      type: p.type,
      status
    };
  });

  // Compute character category counts across all paragraphs
  let hira = 0, kata = 0, kanji = 0, latin = 0, digit = 0, other = 0;
  for (const p of result.paragraphs) {
    const text = p.text || '';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (/\s/.test(ch)) continue;
      if (/[\u3041-\u3096]/.test(ch)) { hira++; continue; }
      if (/[\u30A1-\u30FA\u30FC]/.test(ch)) { kata++; continue; }
      if (/[\u4E00-\u9FFF]/.test(ch)) { kanji++; continue; }
      if (/[A-Za-z]/.test(ch)) { latin++; continue; }
      if (/[0-9]/.test(ch)) { digit++; continue; }
      other++;
    }
  }
  const countedTotal = hira + kata + kanji + latin + digit + other;

  // Build Chart.js v1 pie datasets
  const characterBalance = [
    { value: hira,  color: '#66BB6A', highlight: '#81C784', label: 'ひらがな' },
    { value: kata,  color: '#42A5F5', highlight: '#64B5F6', label: 'カタカナ' },
    { value: kanji, color: '#EF5350', highlight: '#E57373', label: '漢字' },
    { value: latin, color: '#AB47BC', highlight: '#BA68C8', label: '英字' },
    { value: digit, color: '#FFA726', highlight: '#FFB74D', label: '数字' },
    { value: other, color: '#BDBDBD', highlight: '#E0E0E0', label: 'その他' }
  ];

  const nonKanji = Math.max(0, countedTotal - kanji);
  const joyoPie = [
    { value: kanji, color: '#29B6F6', highlight: '#4FC3F7', label: '漢字' },
    { value: nonKanji, color: '#90A4AE', highlight: '#B0BEC5', label: 'その他' }
  ];

  const characterAnalysis = {
    totalChars: totalChars,
    joyoKanjiUsage: countedTotal > 0 ? kanji / countedTotal : 0
  };

  const charts: Record<string, any> = {
    characterBalance,
    joyoKanjiUsage: joyoPie
  };

  return {
    hasContent: true,
    summary: {
      totalParagraphs,
      totalChars,
      overCount,
      underCount,
      thresholds: { min: minThreshold, max: maxThreshold }
    },
    rows,
    charts,
    characterAnalysis,
    timestamp: result.timestamp
  };
}

/**
 * Webviewからのメッセージを処理
 * @param message メッセージ
 */
export async function handleWebviewMessage(message: any): Promise<void> {
  switch (message.type) {
    case 'jumpToParagraph':
      await jumpToParagraph(message.paragraphId, message.range);
      break;
    
    case 'refresh':
      try {
        const active = vscode.window.activeTextEditor;
        if (active && active.document.languageId === 'markdown') {
          await runAnalysis(active.document);
        } else {
          const lastUri = getLastAnalyzedUri();
          if (lastUri) {
            await runAnalysisForUri(lastUri);
          }
        }
      } catch (e) {
        console.warn('[Panel] Refresh analysis failed:', e);
      }
      await updatePanelContent();
      break;
    
    case 'openSettings':
      await vscode.commands.executeCommand('workbench.action.openSettings', 'criticalWritingJp');
      break;
    
    case 'toggleKeywordHighlight':
      try {
        await toggleKeywordHighlight(message.enabled);
        // パネルに状態変更を通知
        if (currentPanel) {
          currentPanel.webview.postMessage({
            type: 'keywordHighlightChanged',
            enabled: message.enabled
          });
        }
      } catch (e) {
        console.warn('[Panel] Toggle keyword highlight failed:', e);
        vscode.window.showErrorMessage('キーワードハイライトの切り替えに失敗しました');
      }
      break;

    case 'reorderParagraphs':
      await reorderParagraphs(message.payload);
      break;
    
    default:
      console.warn('[Panel] Unknown message type:', message.type);
      break;
  }
}

/**
 * キーワードハイライト機能の切り替え
 * @param enabled ハイライトを有効にするかどうか
 */
async function toggleKeywordHighlight(enabled: boolean): Promise<void> {
  keywordHighlightEnabled = enabled;
  console.log(`[Panel] Keyword highlight ${enabled ? 'enabled' : 'disabled'}`);

  // 対象エディタを解決（アクティブ → 可視 → 最終解析URIを開く）
  const editor = await resolveEditorForHighlighting();
  if (!editor) {
    console.log('[Panel] No suitable editor found for keyword highlighting');
    return;
  }

  if (enabled) {
    // キーワードハイライトを有効にする - まず再解析を実行してキーワードを抽出
    console.log(`[Panel] Re-analyzing document to extract keywords for highlighting`);
    const { runAnalysis } = await import('./analyzer');
    await runAnalysis(editor.document);

    // 再解析後にキーワードハイライトを適用
    await applyKeywordHighlights(editor);
  } else {
    // キーワードハイライトを無効にする
    // 再解析を実行してAnalyzer側のキーワード装飾を空に更新（setDecorations([], ...)でクリア）
    const { runAnalysis } = await import('./analyzer');
    await runAnalysis(editor.document);
    // UI装飾側のキーワードハイライトを削除
    await clearKeywordHighlights(editor);
  }
}

/**
 * ハイライト適用対象となるエディタを解決
 * カーソル挿入なしでも動作するよう、優先順位で選択
 */
async function resolveEditorForHighlighting(): Promise<vscode.TextEditor | undefined> {
  // 1) アクティブエディタ
  const active = vscode.window.activeTextEditor;
  if (active && (active.document.languageId === 'markdown' || active.document.languageId === 'plaintext')) {
    return active;
  }

  // 2) 可視エディタのうち最初のMarkdown/プレーンテキスト
  const visibleEditors = (vscode.window.visibleTextEditors || []) as readonly vscode.TextEditor[];
  const visible = visibleEditors.find(e => e.document && (e.document.languageId === 'markdown' || e.document.languageId === 'plaintext'));
  if (visible) {
    return visible;
  }

  // 3) 最後に解析したURIを開く（フォーカスを奪わない）
  try {
    const lastUri = getLastAnalyzedUri();
    if (lastUri) {
      const uri = vscode.Uri.parse(lastUri);
      const doc = await vscode.workspace.openTextDocument(uri);
      // preserveFocus: true でフォーカスを奪わない
      return await vscode.window.showTextDocument(doc, { preview: false, preserveFocus: true });
    }
  } catch (e) {
    console.warn('[Panel] Failed to open last analyzed document for highlighting', e);
  }

  return undefined;
}

/**
 * キーワードハイライトを適用
 * @param editor エディタ
 */
async function applyKeywordHighlights(editor: vscode.TextEditor): Promise<void> {
  try {
    // キーワード抽出エンジンから現在の分析結果を取得
    const uri = editor.document.uri.toString();
    const result = getCachedAnalysisResult(uri);
    
    if (!result || !result.keywords) {
      console.log('[Panel] No keywords available for highlighting');
      return;
    }

    // UI装飾システムにキーワードハイライトを適用
    if (!extensionContext) {
      console.error('[Panel] Extension context not available for keyword highlighting');
      return;
    }
    const { UIDecorations } = await import('./ui-decorations');
    const uiDecorations = UIDecorations.getInstance(extensionContext);
    await uiDecorations.applyKeywordHighlights(editor, result.keywords);
  } catch (error) {
    console.error('[Panel] Failed to apply keyword highlights:', error);
  }
}

/**
 * キーワードハイライトをクリア
 * @param editor エディタ
 */
async function clearKeywordHighlights(editor: vscode.TextEditor): Promise<void> {
  try {
    // UI装飾システムからキーワードハイライトを削除
    if (!extensionContext) {
      console.error('[Panel] Extension context not available for clearing keyword highlights');
      return;
    }
    const { UIDecorations } = await import('./ui-decorations');
    const uiDecorations = UIDecorations.getInstance(extensionContext);
    await uiDecorations.clearKeywordHighlights(editor);
  } catch (error) {
    console.error('[Panel] Failed to clear keyword highlights:', error);
  }
}

/**
 * 指定された段落にジャンプ
 * @param paragraphId 段落ID
 * @param range 段落の範囲
 */
async function jumpToParagraph(paragraphId: string, range: { start: number; end: number }): Promise<void> {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    return;
  }

  try {
    const startPos = activeEditor.document.positionAt(range.start);
    const endPos = activeEditor.document.positionAt(range.end);
    const selection = new vscode.Range(startPos, endPos);

    // エディタにフォーカスを移し、範囲を選択
    await vscode.window.showTextDocument(activeEditor.document, activeEditor.viewColumn);
    activeEditor.selection = new vscode.Selection(startPos, endPos);
    activeEditor.revealRange(selection, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
  } catch (error) {
    console.error('[Panel] Failed to jump to paragraph:', error);
    vscode.window.showErrorMessage('段落へのジャンプに失敗しました');
  }
}

/**
 * WebviewのHTMLコンテンツを生成
 * @param webview Webviewインスタンス
 * @param extensionUri 拡張機能のURI
 * @returns HTMLコンテンツ
 */
function getWebviewContent(webview: vscode.Webview): string {
  // CSPのnonce生成
  const nonce = getNonce();

  return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' https://cdn.jsdelivr.net; img-src ${webview.cspSource} data:;">
    <title>CriticalWritingJp</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@1.0.0/Chart.min.js" nonce="${nonce}"></script>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 16px;
            margin: 0;
            line-height: 1.4;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap; /* Prevent overlap on narrow widths */
            gap: 8px 12px;
            margin-bottom: 16px;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .title {
            font-size: 18px;
            font-weight: bold;
            color: var(--vscode-titleBar-activeForeground);
            flex: 1 1 auto;
            min-width: 120px;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
        }
        .actions {
            display: flex;
            flex: 0 1 auto;
            flex-wrap: wrap;
            align-items: center;
            justify-content: flex-end;
            gap: 8px;
            min-width: 220px;
        }
        .summary {
            background: var(--vscode-editor-inactiveSelectionBackground);
            padding: 12px;
            border-radius: 4px;
            margin-bottom: 16px;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 12px;
        }
        .summary-item {
            text-align: center;
        }
        .summary-value {
            font-size: 24px;
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
        }
        .summary-label {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
        }
        .paragraph-list {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            overflow: hidden;
        }
        .paragraph-item {
            display: flex;
            align-items: center;
            padding: 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
            cursor: pointer;
            transition: background-color 0.2s;
        }
        .paragraph-item:last-child {
            border-bottom: none;
        }
        .paragraph-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .paragraph-preview {
            flex: 1;
            margin-right: 12px;
            color: var(--vscode-editor-foreground);
            font-size: 14px;
        }
        .paragraph-meta {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            min-width: 80px;
        }
        .paragraph-controls {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-right: 12px;
        }
        .btn-icon {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: 3px;
            padding: 2px 6px;
            cursor: pointer;
            font-size: 12px;
            line-height: 1;
        }
        .btn-icon:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        .paragraph-chars {
            font-weight: bold;
            font-size: 11px;
            margin-bottom: 2px;
        }
        .paragraph-type {
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
            text-transform: uppercase;
        }
        .status-normal { color: var(--vscode-foreground); }
        .status-over { color: var(--vscode-errorForeground); }
        .status-under { color: var(--vscode-warningForeground); }
        .empty-message {
            text-align: center;
            color: var(--vscode-descriptionForeground);
            padding: 40px 20px;
            font-style: italic;
        }
        .button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
        }
        .button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .button-secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .button-secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        .toggle-button {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            padding: 6px 12px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
            margin-right: 8px;
        }
        .toggle-button.active {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .toggle-button:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        .toggle-button.active:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .charts-section {
            margin-bottom: 20px;
            background: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 6px;
            padding: 16px;
        }
        .charts-title {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 16px;
            color: var(--vscode-titleBar-activeForeground);
        }
        .charts-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }
        .chart-container {
            text-align: center;
        }
        .chart-label {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 8px;
            color: var(--vscode-foreground);
        }
        .chart-canvas {
            max-width: 100%;
            max-height: 250px;
        }
        .chart-stats {
            margin-top: 8px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        @media (max-width: 600px) {
            .charts-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">CriticalWritingJp</div>
        <div class="actions">
            <button class="toggle-button" id="keywordHighlightBtn">キーワードハイライト</button>
            <button class="button" id="refreshBtn">更新</button>
            <button class="button" id="settingsBtn">設定</button>
        </div>
    </div>
    
    <div id="content">
        <div class="empty-message">読み込み中...</div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        let keywordHighlightEnabled = false; // Default OFF as required
        
        // Wire header buttons with CSP-safe listeners
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) { refreshBtn.addEventListener('click', () => vscode.postMessage({ type: 'refresh' })); }
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) { settingsBtn.addEventListener('click', () => vscode.postMessage({ type: 'openSettings' })); }
        
        // Keyword highlight toggle button
        const keywordHighlightBtn = document.getElementById('keywordHighlightBtn');
        if (keywordHighlightBtn) {
            keywordHighlightBtn.addEventListener('click', () => {
                keywordHighlightEnabled = !keywordHighlightEnabled;
                updateKeywordHighlightButton();
                vscode.postMessage({ 
                    type: 'toggleKeywordHighlight', 
                    enabled: keywordHighlightEnabled 
                });
            });
        }
        
        // Update keyword highlight button appearance
        function updateKeywordHighlightButton() {
            const btn = document.getElementById('keywordHighlightBtn');
            if (btn) {
                if (keywordHighlightEnabled) {
                    btn.classList.add('active');
                    btn.textContent = 'キーワードハイライト: ON';
                } else {
                    btn.classList.remove('active');
                    btn.textContent = 'キーワードハイライト: OFF';
                }
            }
        }
        
        // Initialize button state
        updateKeywordHighlightButton();
        
        // Event delegation for paragraph click
        const contentEl = document.getElementById('content');
        if (contentEl) {
            contentEl.addEventListener('click', function (ev) {
                var target = ev.target || null;
                // Handle reorder buttons first
                if (target && target.classList) {
                    if (target.classList.contains('btn-move-up') || target.classList.contains('btn-move-down')) {
                        ev.preventDefault();
                        ev.stopPropagation();
                        // find nearest .paragraph-item
                        var item = target.closest ? target.closest('.paragraph-item') : (function () {
                            var el = target;
                            while (el && !(el.classList && el.classList.contains('paragraph-item'))) {
                                el = el.parentElement;
                            }
                            return el || null;
                        })();
                        if (!item) return;
                        var list = item.parentElement; // .paragraph-list
                        if (!list) return;
                        if (target.classList.contains('btn-move-up')) {
                            var prev = item.previousElementSibling;
                            if (prev) {
                                list.insertBefore(item, prev);
                            }
                        } else {
                            var next = item.nextElementSibling;
                            if (next) {
                                list.insertBefore(next, item);
                            }
                        }
                        // Collect new order of IDs and send to extension
                        var ids = Array.from(list.querySelectorAll('.paragraph-item'))
                            .map(function (el) { return el.getAttribute('data-id') || ''; })
                            .filter(function (x) { return !!x; });
                        if (ids.length > 0) {
                            vscode.postMessage({ type: 'reorderParagraphs', payload: ids });
                        }
                        return;
                    }
                }
                // Default: jump to paragraph when clicking the row
                var item2 = (function () {
                    var el = target;
                    while (el && !(el.classList && el.classList.contains('paragraph-item'))) {
                        el = el.parentElement;
                    }
                    return el || null;
                })();
                if (item2) {
                    var id = item2.getAttribute('data-id');
                    var start = Number(item2.getAttribute('data-range-start'));
                    var end = Number(item2.getAttribute('data-range-end'));
                    if (id != null && !Number.isNaN(start) && !Number.isNaN(end)) {
                        vscode.postMessage({ type: 'jumpToParagraph', paragraphId: id, range: { start: start, end: end } });
                    }
                }
            });
        }
        
        function updateContent(payload) {
            const content = document.getElementById('content');
            
            if (!payload.hasContent) {
                content.innerHTML = \`<div class="empty-message">\${payload.message}</div>\`;
                return;
            }
            
            const { summary, rows, charts, characterAnalysis } = payload;
            
            content.innerHTML = \`
                <div class="charts-title">段落分析</div>
                <div class="summary">
                    <div class="summary-item">
                        <div class="summary-value">\${summary.totalParagraphs}</div>
                        <div class="summary-label">段落</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-value">\${summary.totalChars.toLocaleString()}</div>
                        <div class="summary-label">文字</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-value status-over">\${summary.overCount}</div>
                        <div class="summary-label">超過 (>\${summary.thresholds.max})</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-value status-under">\${summary.underCount}</div>
                        <div class="summary-label">不足 (<\${summary.thresholds.min})</div>
                    </div>
                </div>
                
                <!-- 文字種解析グラフセクション -->
                <div class="charts-section">
                    <div class="charts-title">文字種解析</div>
                    <div class="charts-grid">
                        <div class="chart-container">
                            <div class="chart-label">文字種バランス</div>
                            <canvas id="characterBalanceChart" class="chart-canvas"></canvas>
                            <div class="chart-stats">
                                総文字数: \${characterAnalysis.totalChars.toLocaleString()}文字
                            </div>
                        </div>
                        <div class="chart-container">
                            <div class="chart-label">常用漢字使用状況</div>
                            <canvas id="joyoKanjiChart" class="chart-canvas"></canvas>
                            <div class="chart-stats">
                                使用率: \${Math.round(characterAnalysis.joyoKanjiUsage * 100)}%
                            </div>
                        </div>
                    </div>
                </div>
                <div class="paragraph-list">
                    \${rows.map((row, index) => \`
                        <div class=\"paragraph-item\" data-id=\"\${row.id}\" data-range-start=\"\${row.range.start}\" data-range-end=\"\${row.range.end}\">\n                            <div class=\"paragraph-preview\">\${row.preview}</div>\n                            <div class=\"paragraph-controls\">\n                                <button class=\"btn-icon btn-move-up\" title=\"上へ\">↑</button>\n                                <button class=\"btn-icon btn-move-down\" title=\"下へ\">↓</button>\n                            </div>\n                            <div class=\"paragraph-meta\">\n                                <div class=\"paragraph-chars status-\${row.status}\">\${row.chars}文字</div>\n                                <div class=\"paragraph-type\">\${row.type}</div>\n                            </div>\n                        </div>
                    \`).join('')}
                </div>
            \`;
            
            // 円グラフを描画
            setTimeout(() => {
                const styles = getComputedStyle(document.documentElement);
                const legendColor = (styles.getPropertyValue('--vscode-foreground') || '').trim() || '#cccccc';
                const borderColor = (styles.getPropertyValue('--vscode-panel-border') || '').trim() || '#444444';
                try {
                    if (typeof Chart === 'undefined' || !charts) {
                        return;
                    }
                } catch (e) { return; }
                drawCharts(charts, { legendColor, borderColor });
            }, 100);
        }
        
        function drawCharts(charts, theme) {
            // 既存のチャートインスタンスがあれば安全に破棄
            if (window.characterBalanceChart && typeof window.characterBalanceChart.destroy === 'function') {
                window.characterBalanceChart.destroy();
            }
            window.characterBalanceChart = undefined;
            if (window.joyoKanjiChart && typeof window.joyoKanjiChart.destroy === 'function') {
                window.joyoKanjiChart.destroy();
            }
            window.joyoKanjiChart = undefined;
            
            // 文字種バランス円グラフ
            const balanceCtx = document.getElementById('characterBalanceChart');
            if (balanceCtx && charts.characterBalance) {
                try {
                    var ctx1 = balanceCtx.getContext && balanceCtx.getContext('2d');
                    if (ctx1) {
                        window.characterBalanceChart = new Chart(ctx1).Pie(charts.characterBalance, {
                            segmentStrokeColor: theme.borderColor || '#444444',
                            segmentStrokeWidth: 1,
                            animationEasing: 'easeOutQuart',
                            responsive: true,
                            maintainAspectRatio: true
                        });
                    }
                } catch (e) {}
            }
            
            // 常用漢字使用率円グラフ
            const joyoCtx = document.getElementById('joyoKanjiChart');
            if (joyoCtx && charts.joyoKanjiUsage) {
                try {
                    var ctx2 = joyoCtx.getContext && joyoCtx.getContext('2d');
                    if (ctx2) {
                        window.joyoKanjiChart = new Chart(ctx2).Pie(charts.joyoKanjiUsage, {
                            segmentStrokeColor: theme.borderColor || '#444444',
                            segmentStrokeWidth: 1,
                            animationEasing: 'easeOutQuart',
                            responsive: true,
                            maintainAspectRatio: true
                        });
                    }
                } catch (e) {}
            }
        }
        
        function jumpToParagraph(paragraphId, range) {
            vscode.postMessage({
                type: 'jumpToParagraph',
                paragraphId: paragraphId,
                range: range
            });
        }
        
        function refresh() {
            vscode.postMessage({ type: 'refresh' });
        }
        
        function openSettings() {
            vscode.postMessage({ type: 'openSettings' });
        }
        
        // メッセージ受信処理
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.type) {
                case 'update':
                    updateContent(message.payload);
                    break;
            }
        });
    </script>
</body>
</html>`;
}

/**
 * ランダムなnonce文字列を生成
 * @returns nonce文字列
 */
function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

/**
 * パネルのコンテンツを外部から更新
 */
export async function updatePanel(): Promise<void> {
  if (currentPanel) {
    await updatePanelContent();
  }
}

/**
 * エディタ内の段落を並べ替える
 * @param newOrderParagraphIds 並べ替え後の段落IDの配列
 */
async function reorderParagraphs(newOrderParagraphIds: string[]): Promise<void> {
  const targetUri = getLastAnalyzedUri();
  if (!targetUri) {
    vscode.window.showWarningMessage('並べ替え対象のファイルが見つかりません。');
    return;
  }

  const documentUri = vscode.Uri.parse(targetUri);
  const document = await vscode.workspace.openTextDocument(documentUri);
  const editor = vscode.window.visibleTextEditors.find(
    (e) => e.document.uri.toString() === targetUri
  );

  if (!document) {
    vscode.window.showErrorMessage('ドキュメントを開けませんでした。');
    return;
  }

  const cachedResult = getCachedAnalysisResult(targetUri);

  if (!cachedResult || !cachedResult.paragraphs) {
    vscode.window.showWarningMessage('並べ替えの基準となる解析データが見つかりません。');
    return;
  }

  const originalParagraphs = cachedResult.paragraphs;

  if (originalParagraphs.length !== newOrderParagraphIds.length) {
    vscode.window.showErrorMessage('段落数が一致しないため、並べ替えを中止しました。');
    return;
  }

  // 元の段落IDの集合で検証
  const originalIds = new Set(originalParagraphs.map(p => p.id));
  for (const id of newOrderParagraphIds) {
    if (!originalIds.has(id)) {
      vscode.window.showErrorMessage(`ID '${id}' の段落が見つかりませんでした。並べ替えを中止します。`);
      return;
    }
  }

  // 各段落の末尾セパレータを抽出（次の段落開始まで）
  const pieces: string[] = [];
  const fullText = document.getText();
  const idToPara = new Map(originalParagraphs.map(p => [p.id, p]));

  const getSeparator = (idx: number): string => {
    const isLast = idx === originalParagraphs.length - 1;
    if (isLast) {
      // ドキュメント末尾のテキスト（末尾空白含む）
      const endOffset = originalParagraphs[idx].range.end;
      return fullText.slice(endOffset);
    }
    const endOffset = originalParagraphs[idx].range.end;
    const nextStart = originalParagraphs[idx + 1].range.start;
    return fullText.slice(endOffset, nextStart);
  };

  // 段落ID -> セパレータのマップ（元の配置に基づく）
  const sepMap = new Map<string, string>();
  for (let i = 0; i < originalParagraphs.length; i++) {
    sepMap.set(originalParagraphs[i].id, getSeparator(i));
  }

  for (let i = 0; i < newOrderParagraphIds.length; i++) {
    const id = newOrderParagraphIds[i];
    const p = idToPara.get(id)!;
    const text = p.text || '';
    const sep = sepMap.get(id) ?? '\n\n';
    pieces.push(text + sep);
  }

  const newContent = pieces.join('');

  const edit = new vscode.WorkspaceEdit();
  const fullStart = document.positionAt(0);
  const fullEnd = document.positionAt(fullText.length);
  const fullRange = new vscode.Range(fullStart, fullEnd);
  edit.replace(document.uri, fullRange, newContent);

  try {
    const success = await vscode.workspace.applyEdit(edit);
    if (success) {
      vscode.window.setStatusBarMessage('段落を並べ替えました。', 3000);
      await runAnalysis(document);
      await updatePanel();
    } else {
      vscode.window.showErrorMessage('段落の並べ替えに失敗しました。');
    }
  } catch (error) {
    console.error('Failed to apply paragraph reorder edit:', error);
    vscode.window.showErrorMessage('段落の並べ替え中にエラーが発生しました。');
  }
}