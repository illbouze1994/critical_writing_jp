import * as vscode from 'vscode';
import { AnalysisResult } from '../core/types';
import { getCachedAnalysisResult } from './analyzer';

let currentPanel: vscode.WebviewPanel | undefined;

/**
 * パネルを作成または表示
 * @param context 拡張機能のコンテキスト
 */
export async function createOrShowPanel(context: vscode.ExtensionContext): Promise<void> {
  const columnToShowIn = vscode.window.activeTextEditor
    ? vscode.window.activeTextEditor.viewColumn
    : undefined;

  if (currentPanel) {
    // 既存のパネルを表示
    currentPanel.reveal(columnToShowIn);
    await updatePanelContent();
    return;
  }

  // 新しいパネルを作成
  currentPanel = vscode.window.createWebviewPanel(
    'criticalWritingJp.panel',
    'CriticalWritingJp',
    columnToShowIn || vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: false,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, 'webview')
      ]
    }
  );

  // パネルのHTMLコンテンツを設定
  currentPanel.webview.html = getWebviewContent(currentPanel.webview);

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

  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor || activeEditor.document.languageId !== 'markdown') {
    // Markdownファイルが開かれていない場合
    currentPanel.webview.postMessage({
      type: 'update',
      payload: {
        hasContent: false,
        message: 'Markdownファイルを開いてください'
      }
    });
    return;
  }

  // キャッシュから解析結果を取得
  const result = getCachedAnalysisResult(activeEditor.document.uri.toString());
  if (!result) {
    currentPanel.webview.postMessage({
      type: 'update',
      payload: {
        hasContent: false,
        message: '解析中...'
      }
    });
    return;
  }

  // 解析結果をWebviewに送信
  const payload = createPanelPayload(result);
  currentPanel.webview.postMessage({
    type: 'update',
    payload
  });
}

/**
 * パネル表示用のデータを作成
 * @param result 解析結果
 * @returns パネル表示用データ
 */
function createPanelPayload(result: AnalysisResult) {
  const totalParagraphs = result.paragraphs.length;
  const totalChars = result.paragraphs.reduce((sum, p) => sum + p.chars, 0);
  
  // 設定値を取得（簡易版）
  const config = vscode.workspace.getConfiguration('criticalWritingJp');
  const minThreshold = config.get<number>('counting.threshold.min', 200);
  const maxThreshold = config.get<number>('counting.threshold.max', 800);
  const previewChars = config.get<number>('ui.preview.headChars', 40);
  
  const overCount = result.paragraphs.filter(p => p.chars > maxThreshold).length;
  const underCount = result.paragraphs.filter(p => p.chars < minThreshold).length;

  const rows = result.paragraphs.map(paragraph => {
    // プレビューテキストを作成
    const previewText = paragraph.text.replace(/\n/g, ' ').substring(0, previewChars);
    const preview = previewText.length < paragraph.text.length ? `${previewText}...` : previewText;

    // 状態を判定
    let status: 'normal' | 'over' | 'under' = 'normal';
    if (paragraph.chars > maxThreshold) {
      status = 'over';
    } else if (paragraph.chars < minThreshold) {
      status = 'under';
    }

    return {
      id: paragraph.id,
      preview,
      chars: paragraph.chars,
      type: paragraph.type,
      status,
      range: paragraph.range
    };
  });

  return {
    hasContent: true,
    summary: {
      totalParagraphs,
      totalChars,
      overCount,
      underCount,
      thresholds: {
        min: minThreshold,
        max: maxThreshold
      }
    },
    rows,
    timestamp: result.timestamp
  };
}

/**
 * Webviewからのメッセージを処理
 * @param message メッセージ
 */
async function handleWebviewMessage(message: any): Promise<void> {
  switch (message.type) {
    case 'jumpToParagraph':
      await jumpToParagraph(message.paragraphId, message.range);
      break;
    
    case 'refresh':
      await updatePanelContent();
      break;
    
    case 'openSettings':
      await vscode.commands.executeCommand('workbench.action.openSettings', 'criticalWritingJp');
      break;
    
    default:
      console.warn('[Panel] Unknown message type:', message.type);
      break;
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
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>CriticalWritingJp</title>
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
            margin-bottom: 16px;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .title {
            font-size: 18px;
            font-weight: bold;
            color: var(--vscode-titleBar-activeForeground);
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
        }
        .paragraph-meta {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            min-width: 80px;
        }
        .paragraph-chars {
            font-weight: bold;
            margin-bottom: 2px;
        }
        .paragraph-type {
            font-size: 11px;
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
    </style>
</head>
<body>
    <div class="header">
        <div class="title">📝 CriticalWritingJp</div>
        <div>
            <button class="button button-secondary" onclick="refresh()">更新</button>
            <button class="button" onclick="openSettings()">設定</button>
        </div>
    </div>
    
    <div id="content">
        <div class="empty-message">読み込み中...</div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        
        function updateContent(payload) {
            const content = document.getElementById('content');
            
            if (!payload.hasContent) {
                content.innerHTML = \`<div class="empty-message">\${payload.message}</div>\`;
                return;
            }
            
            const { summary, rows } = payload;
            
            content.innerHTML = \`
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
                <div class="paragraph-list">
                    \${rows.map((row, index) => \`
                        <div class="paragraph-item" onclick="jumpToParagraph('\${row.id}', \${JSON.stringify(row.range).replace(/"/g, '&quot;')})">
                            <div class="paragraph-preview">\${row.preview}</div>
                            <div class="paragraph-meta">
                                <div class="paragraph-chars status-\${row.status}">\${row.chars}文字</div>
                                <div class="paragraph-type">\${row.type}</div>
                            </div>
                        </div>
                    \`).join('')}
                </div>
            \`;
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