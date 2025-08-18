import * as vscode from 'vscode';
import { AnalysisResult } from '../core/types';
import { getCachedAnalysisResult, getLastAnalyzedUri, runAnalysis, runAnalysisForUri } from './analyzer';
import { TextAnalyzer } from '../core/text-analyzer';

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
  if (activeEditor && activeEditor.document.languageId === 'markdown') {
    targetUri = activeEditor.document.uri.toString();
  }
  if (!targetUri) {
    const visibleMd = vscode.window.visibleTextEditors.find(e => e.document.languageId === 'markdown');
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
          message: 'Markdownファイルを開いてください'
        }
      });
    } catch {}
    return;
  }

  const result = getCachedAnalysisResult(targetUri);
  if (!result) {
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

  // 文字種分析を実行（全段落のテキストを結合）
  const allTexts = result.paragraphs.map(p => p.text);
  const characterAnalysis = TextAnalyzer.analyzeParagraphs(allTexts);
  const pieChartData = TextAnalyzer.createPieChartData(characterAnalysis);

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
    // 円グラフデータを追加
    charts: {
      characterBalance: pieChartData.characterBalance,
      joyoKanjiUsage: pieChartData.joyoKanjiUsage
    },
    // 文字種分析結果を追加
    characterAnalysis: {
      totalChars: characterAnalysis.totalChars,
      joyoKanjiUsage: characterAnalysis.joyoKanjiUsage,
      ratios: characterAnalysis.ratios,
      counts: characterAnalysis.counts
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
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' https://cdn.jsdelivr.net; img-src ${webview.cspSource} data:;">
    <title>CriticalWritingJp</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js" nonce="${nonce}"></script>
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
            font-size: 14px;
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
        <div class="title">📝 CriticalWritingJp</div>
        <div>
            <button class="button" id="refreshBtn">更新</button>
            <button class="button" id="settingsBtn">設定</button>
        </div>
    </div>
    
    <div id="content">
        <div class="empty-message">読み込み中...</div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        
        // Wire header buttons with CSP-safe listeners
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) { refreshBtn.addEventListener('click', () => vscode.postMessage({ type: 'refresh' })); }
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) { settingsBtn.addEventListener('click', () => vscode.postMessage({ type: 'openSettings' })); }
        
        // Event delegation for paragraph click
        const contentEl = document.getElementById('content');
        if (contentEl) {
            contentEl.addEventListener('click', (ev) => {
                const target = ev.target;
                const item = target && target.closest ? target.closest('.paragraph-item') : null;
                if (item) {
                    const id = item.getAttribute('data-id');
                    const start = Number(item.getAttribute('data-range-start'));
                    const end = Number(item.getAttribute('data-range-end'));
                    if (id != null && !Number.isNaN(start) && !Number.isNaN(end)) {
                        vscode.postMessage({ type: 'jumpToParagraph', paragraphId: id, range: { start, end } });
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
                
                <!-- 円グラフセクション -->
                <div class="charts-section">
                    <div class="charts-title">📊 文字種バランス・常用漢字使用状況</div>
                    <div class="charts-grid">
                        <div class="chart-container">
                            <div class="chart-label">文字種バランス</div>
                            <canvas id="characterBalanceChart" class="chart-canvas"></canvas>
                            <div class="chart-stats">
                                総文字数: \${characterAnalysis.totalChars.toLocaleString()}文字
                            </div>
                        </div>
                        <div class="chart-container">
                            <div class="chart-label">常用漢字使用率</div>
                            <canvas id="joyoKanjiChart" class="chart-canvas"></canvas>
                            <div class="chart-stats">
                                使用率: \${Math.round(characterAnalysis.joyoKanjiUsage * 100)}%
                            </div>
                        </div>
                    </div>
                </div>
                <div class="paragraph-list">
                    \${rows.map((row, index) => \`
                        <div class=\"paragraph-item\" data-id=\"\${row.id}\" data-range-start=\"\${row.range.start}\" data-range-end=\"\${row.range.end}\">\n                            <div class=\"paragraph-preview\">\${row.preview}</div>\n                            <div class=\"paragraph-meta\">\n                                <div class=\"paragraph-chars status-\${row.status}\">\${row.chars}文字</div>\n                                <div class=\"paragraph-type\">\${row.type}</div>\n                            </div>\n                        </div>
                    \`).join('')}
                </div>
            \`;
            
            // 円グラフを描画
            setTimeout(() => {
                const styles = getComputedStyle(document.documentElement);
                const legendColor = (styles.getPropertyValue('--vscode-foreground') || '').trim() || '#cccccc';
                const borderColor = (styles.getPropertyValue('--vscode-panel-border') || '').trim() || '#444444';
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
                window.characterBalanceChart = new Chart(balanceCtx, {
                    type: 'pie',
                    data: charts.characterBalance,
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: {
                                    color: theme.legendColor,
                                    font: {
                                        size: 11
                                    },
                                    padding: 10
                                }
                            },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                        const percentage = ((context.parsed / total) * 100).toFixed(1);
                                        return \`\${context.label}: \${context.parsed}文字 (\${percentage}%)\`;
                                    }
                                }
                            }
                        },
                        elements: {
                            arc: {
                                borderWidth: 1,
                                borderColor: theme.borderColor
                            }
                        }
                    }
                });
            }
            
            // 常用漢字使用率円グラフ
            const joyoCtx = document.getElementById('joyoKanjiChart');
            if (joyoCtx && charts.joyoKanjiUsage) {
                window.joyoKanjiChart = new Chart(joyoCtx, {
                    type: 'pie',
                    data: charts.joyoKanjiUsage,
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: {
                                    color: theme.legendColor,
                                    font: {
                                        size: 11
                                    },
                                    padding: 10
                                }
                            },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                        const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : '0.0';
                                        return \`\${context.label}: \${context.parsed}文字 (\${percentage}%)\`;
                                    }
                                }
                            }
                        },
                        elements: {
                            arc: {
                                borderWidth: 1,
                                borderColor: theme.borderColor
                            }
                        }
                    }
                });
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