/**
 * Webviewパネル機能の実装
 * 段落解析結果、LLMスコア、Google Books検索結果を表示する
 */

import * as vscode from 'vscode';
import { PanelUpdate } from '../core/ipc-types';
import { ParagraphAnalysisResult } from '../core/paragraph-analyzer';
import { LLMEvaluationResult, GoogleBooksResult } from '../core/ipc-types';
import { Settings } from '../platform/settings';

/**
 * Webviewパネルの管理クラス
 */
export class WebviewPanel {
  private static instance: WebviewPanel | null = null;
  private panel: vscode.WebviewPanel | null = null;
  private isDisposed = false;

  private constructor(private context: vscode.ExtensionContext) {}

  /**
   * シングルトンインスタンスを取得
   */
  static getInstance(context: vscode.ExtensionContext): WebviewPanel {
    if (!WebviewPanel.instance) {
      WebviewPanel.instance = new WebviewPanel(context);
    }
    return WebviewPanel.instance;
  }

  /**
   * パネルを作成または表示
   */
  async createOrShow(): Promise<void> {
    if (this.panel) {
      // 既存のパネルを前面に表示
      this.panel.reveal(vscode.ViewColumn.Two);
      return;
    }

    // 新しいパネルを作成
    this.panel = vscode.window.createWebviewPanel(
      'criticalWritingJpPanel',
      'CriticalWriting分析結果',
      vscode.ViewColumn.Two,
      {
        // Webviewのオプション
        enableScripts: true,
        retainContextWhenHidden: false,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, 'dist'),
          vscode.Uri.joinPath(this.context.extensionUri, 'webview-assets')
        ]
      }
    );

    // パネルのHTMLを設定
    this.panel.webview.html = this.generateWebviewHTML();

    // メッセージハンドリング
    this.panel.webview.onDidReceiveMessage(
      message => this.handleMessage(message),
      undefined,
      this.context.subscriptions
    );

    // パネルの破棄処理
    this.panel.onDidDispose(
      () => {
        this.panel = null;
        this.isDisposed = true;
      },
      null,
      this.context.subscriptions
    );
  }

  /**
   * 分析結果でパネルを更新
   */
  async updateWithAnalysisResult(
    result: ParagraphAnalysisResult,
    llmResults?: Map<string, LLMEvaluationResult>,
    booksResults?: Map<string, GoogleBooksResult[]>
  ): Promise<void> {
    if (!this.panel || this.isDisposed) {
      return;
    }

    const settings = new Settings();
    const { min: minThreshold, max: maxThreshold } = settings.counting.threshold;

    // パネル更新メッセージの作成
    const updateMessage: PanelUpdate = {
      type: 'panel/update',
      payload: {
        summary: {
          total: result.statistics.totalCount,
          over: result.paragraphs.filter(p => p.chars > maxThreshold).length,
          under: result.paragraphs.filter(p => p.chars < minThreshold).length
        },
        rows: result.paragraphs.map(paragraph => {
          const llmResult = llmResults?.get(paragraph.id);
          const booksResult = booksResults?.get(paragraph.id);

          return {
            id: paragraph.id,
            head: this.truncateText(paragraph.text, settings.ui.preview.headChars),
            chars: paragraph.chars,
            kw: this.extractKeywords(paragraph),
            roi: paragraph.features?.roi,
            llm: llmResult ? (llmResult.style + llmResult.argumentation) / 2 : undefined
          };
        })
      }
    };

    // Webviewにメッセージを送信
    await this.panel.webview.postMessage(updateMessage);
  }

  /**
   * Webviewからのメッセージハンドリング
   */
  private async handleMessage(message: any): Promise<void> {
    switch (message.command) {
      case 'jumpToParagraph':
        await this.jumpToParagraph(message.paragraphId);
        break;

      case 'requestBooksSearch':
        await this.handleBooksSearchRequest(message.paragraphId, message.searchPhrase);
        break;

      case 'enableLLM':
        await this.handleLLMEnableRequest();
        break;

      case 'configureGoogleBooks':
        await this.handleGoogleBooksConfigRequest();
        break;

      case 'refreshAnalysis':
        await vscode.commands.executeCommand('criticalWritingJp.runKeywordNow');
        break;

      default:
        console.warn(`[WebviewPanel] Unknown message command: ${message.command}`);
    }
  }

  /**
   * 段落へのジャンプ
   */
  private async jumpToParagraph(paragraphId: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    // 段落IDから位置を特定する処理（実装では段落キャッシュから検索）
    // ここでは簡略化
    console.log(`[WebviewPanel] Jump to paragraph: ${paragraphId}`);
  }

  /**
   * Google Books検索リクエストの処理
   */
  private async handleBooksSearchRequest(paragraphId: string, searchPhrase: string): Promise<void> {
    try {
      // Google Books検索の実行
      const { GoogleBooksClient } = await import('./google-books-client');
      const client = new GoogleBooksClient(this.context);
      
      if (!await client.checkApiKeyAvailable()) {
        vscode.window.showWarningMessage('Google Books APIキーが設定されていません');
        return;
      }

      const results = await client.searchExactPhrase({ phrase: searchPhrase });
      
      // 結果をWebviewに送信
      await this.panel?.webview.postMessage({
        type: 'booksSearchResult',
        paragraphId,
        results
      });

    } catch (error) {
      console.error('[WebviewPanel] Books search failed:', error);
      vscode.window.showErrorMessage(`書籍検索に失敗しました: ${error.message}`);
    }
  }

  /**
   * LLM有効化リクエストの処理
   */
  private async handleLLMEnableRequest(): Promise<void> {
    try {
      const { LLMEvaluator } = await import('./llm-evaluator');
      const evaluator = LLMEvaluator.getInstance(this.context);
      
      const success = await evaluator.enableWithConsent();
      await this.panel?.webview.postMessage({
        type: 'llmStatusUpdate',
        enabled: success
      });

    } catch (error) {
      console.error('[WebviewPanel] LLM enable failed:', error);
    }
  }

  /**
   * Google Books設定リクエストの処理
   */
  private async handleGoogleBooksConfigRequest(): Promise<void> {
    await vscode.commands.executeCommand('criticalWritingJp.configureGoogleBooksKey');
  }

  /**
   * WebviewのHTML生成
   */
  private generateWebviewHTML(): string {
    if (!this.panel) {
      return '';
    }

    const webview = this.panel.webview;
    
    // CSPのnonce生成
    const nonce = this.generateNonce();
    
    // スタイルファイルのURI
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'webview-assets', 'styles.css')
    );

    return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="
        default-src 'none';
        style-src ${webview.cspSource} 'nonce-${nonce}';
        script-src 'nonce-${nonce}';
        img-src ${webview.cspSource} data:;
        font-src ${webview.cspSource};
    ">
    <link href="${styleUri}" rel="stylesheet" nonce="${nonce}">
    <title>CriticalWriting分析結果</title>
</head>
<body>
    <div id="app">
        <header class="panel-header">
            <h1>📚 文書解析結果</h1>
            <div class="status-indicators">
                <div id="llm-status" class="status-indicator" title="LLM機能の状態">
                    <span class="indicator-icon">🤖</span>
                    <span id="llm-status-text">未有効</span>
                </div>
                <div id="books-status" class="status-indicator" title="Google Books API状態">
                    <span class="indicator-icon">📖</span>
                    <span id="books-status-text">未設定</span>
                </div>
            </div>
        </header>

        <section class="summary-section">
            <div class="summary-card">
                <h3>📊 文書統計</h3>
                <div class="summary-stats">
                    <div class="stat-item">
                        <span class="stat-value" id="total-paragraphs">-</span>
                        <span class="stat-label">総段落数</span>
                    </div>
                    <div class="stat-item warning">
                        <span class="stat-value" id="over-threshold">-</span>
                        <span class="stat-label">閾値超過</span>
                    </div>
                    <div class="stat-item info">
                        <span class="stat-value" id="under-threshold">-</span>
                        <span class="stat-label">閾値未満</span>
                    </div>
                </div>
            </div>
        </section>

        <section class="controls-section">
            <div class="action-buttons">
                <button id="enable-llm-btn" class="action-btn">
                    🤖 LLM機能を有効化
                </button>
                <button id="configure-books-btn" class="action-btn">
                    📖 Google Books設定
                </button>
                <button id="refresh-analysis-btn" class="action-btn">
                    🔄 解析を再実行
                </button>
            </div>
        </section>

        <section class="results-section">
            <h3>📝 段落別詳細</h3>
            <div class="results-table-container">
                <table id="results-table" class="results-table">
                    <thead>
                        <tr>
                            <th>段落</th>
                            <th>文字数</th>
                            <th>キーワード</th>
                            <th>ROI</th>
                            <th>LLM</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody id="results-tbody">
                        <tr class="no-data">
                            <td colspan="6">解析データがありません</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </section>

        <section class="books-section" id="books-section" style="display: none;">
            <h3>📚 書籍検索結果</h3>
            <div id="books-results" class="books-results">
                <!-- 検索結果がここに表示される -->
            </div>
        </section>
    </div>

    <script nonce="${nonce}">
        (function() {
            const vscode = acquireVsCodeApi();
            let currentData = null;

            // VSCode拡張からのメッセージ受信
            window.addEventListener('message', event => {
                const message = event.data;
                
                switch (message.type) {
                    case 'panel/update':
                        updatePanelData(message.payload);
                        break;
                    case 'booksSearchResult':
                        displayBooksResults(message.paragraphId, message.results);
                        break;
                    case 'llmStatusUpdate':
                        updateLLMStatus(message.enabled);
                        break;
                }
            });

            // パネルデータの更新
            function updatePanelData(payload) {
                currentData = payload;
                
                // 統計の更新
                document.getElementById('total-paragraphs').textContent = payload.summary.total;
                document.getElementById('over-threshold').textContent = payload.summary.over;
                document.getElementById('under-threshold').textContent = payload.summary.under;
                
                // 結果テーブルの更新
                updateResultsTable(payload.rows);
            }

            // 結果テーブルの更新
            function updateResultsTable(rows) {
                const tbody = document.getElementById('results-tbody');
                tbody.innerHTML = '';
                
                if (rows.length === 0) {
                    tbody.innerHTML = '<tr class="no-data"><td colspan="6">解析データがありません</td></tr>';
                    return;
                }
                
                rows.forEach(row => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = \`
                        <td class="paragraph-preview">
                            <span class="paragraph-text">\${escapeHtml(row.head)}</span>
                        </td>
                        <td class="char-count \${getCharCountClass(row.chars)}">\${row.chars}</td>
                        <td class="keywords">
                            \${row.kw.map(kw => \`<span class="keyword-tag">\${escapeHtml(kw)}</span>\`).join('')}
                        </td>
                        <td class="roi-score">\${row.roi !== undefined ? row.roi.toFixed(2) : '-'}</td>
                        <td class="llm-score">\${row.llm !== undefined ? row.llm.toFixed(2) : '-'}</td>
                        <td class="actions">
                            <button class="action-btn-small jump-btn" data-paragraph-id="\${row.id}">
                                ジャンプ
                            </button>
                            <button class="action-btn-small search-books-btn" data-paragraph-id="\${row.id}">
                                書籍検索
                            </button>
                        </td>
                    \`;
                    tbody.appendChild(tr);
                });
                
                // イベントリスナーの追加
                addTableEventListeners();
            }

            // テーブルのイベントリスナー追加
            function addTableEventListeners() {
                // ジャンプボタン
                document.querySelectorAll('.jump-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const paragraphId = e.target.dataset.paragraphId;
                        vscode.postMessage({
                            command: 'jumpToParagraph',
                            paragraphId: paragraphId
                        });
                    });
                });
                
                // 書籍検索ボタン
                document.querySelectorAll('.search-books-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const paragraphId = e.target.dataset.paragraphId;
                        const row = currentData.rows.find(r => r.id === paragraphId);
                        if (row) {
                            vscode.postMessage({
                                command: 'requestBooksSearch',
                                paragraphId: paragraphId,
                                searchPhrase: row.head
                            });
                        }
                    });
                });
            }

            // 書籍検索結果の表示
            function displayBooksResults(paragraphId, results) {
                const section = document.getElementById('books-section');
                const container = document.getElementById('books-results');
                
                container.innerHTML = \`
                    <h4>段落「\${paragraphId}」の検索結果</h4>
                    <div class="books-list">
                        \${results.map(book => \`
                            <div class="book-item">
                                <div class="book-title">\${escapeHtml(book.title)}</div>
                                <div class="book-author">\${escapeHtml(book.author)}</div>
                                \${book.year ? \`<div class="book-year">\${book.year}</div>\` : ''}
                                \${book.snippet ? \`<div class="book-snippet">\${escapeHtml(book.snippet)}</div>\` : ''}
                                \${book.url ? \`<a href="\${book.url}" class="book-url" target="_blank">詳細を見る</a>\` : ''}
                            </div>
                        \`).join('')}
                    </div>
                \`;
                
                section.style.display = 'block';
            }

            // LLMステータスの更新
            function updateLLMStatus(enabled) {
                const statusText = document.getElementById('llm-status-text');
                const indicator = document.getElementById('llm-status');
                
                if (enabled) {
                    statusText.textContent = '有効';
                    indicator.classList.add('enabled');
                } else {
                    statusText.textContent = '無効';
                    indicator.classList.remove('enabled');
                }
            }

            // 文字数のクラス判定
            function getCharCountClass(chars) {
                if (chars > 800) return 'over-threshold';
                if (chars < 200) return 'under-threshold';
                return 'normal';
            }

            // HTMLエスケープ
            function escapeHtml(text) {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            }

            // アクションボタンのイベントリスナー
            document.getElementById('enable-llm-btn').addEventListener('click', () => {
                vscode.postMessage({ command: 'enableLLM' });
            });
            
            document.getElementById('configure-books-btn').addEventListener('click', () => {
                vscode.postMessage({ command: 'configureGoogleBooks' });
            });
            
            document.getElementById('refresh-analysis-btn').addEventListener('click', () => {
                vscode.postMessage({ command: 'refreshAnalysis' });
            });
        })();
    </script>
</body>
</html>`;
  }

  /**
   * nonceの生成
   */
  private generateNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * テキストの切り詰め
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * 段落からキーワードを抽出（簡易実装）
   */
  private extractKeywords(paragraph: any): string[] {
    // 実際の実装ではキーワード抽出エンジンを使用
    // ここでは簡易的に実装
    const text = paragraph.text;
    const keywords: string[] = [];
    
    // 簡易的なキーワード抽出（カタカナ語、長い漢字熟語）
    const katakanaMatches = text.match(/[ァ-ヶー]{3,}/g);
    if (katakanaMatches) {
      keywords.push(...katakanaMatches.slice(0, 3));
    }
    
    const kanjiMatches = text.match(/[一-龯]{3,5}/g);
    if (kanjiMatches) {
      keywords.push(...kanjiMatches.slice(0, 2));
    }
    
    return keywords.slice(0, 5); // 最大5個
  }

  /**
   * パネルの破棄
   */
  dispose(): void {
    if (this.panel) {
      this.panel.dispose();
    }
    this.isDisposed = true;
    WebviewPanel.instance = null;
  }
}

/**
 * パネルを作成または表示する関数（エクスポート用）
 */
export async function createOrShowPanel(context: vscode.ExtensionContext): Promise<void> {
  const panel = WebviewPanel.getInstance(context);
  await panel.createOrShow();
}