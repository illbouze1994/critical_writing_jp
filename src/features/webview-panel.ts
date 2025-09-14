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
    result: ParagraphAnalysisResult & { charts: any }, // Add charts to the type
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
          chars: (result.statistics as any).chars || 0,
          over: result.paragraphs.filter(p => p.chars > maxThreshold).length,
          under: result.paragraphs.filter(p => p.chars < minThreshold).length
        },
        charts: result.charts,
        rows: result.paragraphs.map(paragraph => {
          const llmResult = llmResults?.get(paragraph.id);
          const rowData: any = {
            id: paragraph.id,
            head: this.truncateText(paragraph.text, settings.ui.preview.headChars),
            chars: paragraph.chars,
            kw: this.extractKeywords(paragraph),
          };
          if (paragraph.features?.roi !== undefined) {
            rowData.roi = paragraph.features.roi;
          }
          if (llmResult) {
            rowData.llm = (llmResult.style + llmResult.argumentation) / 2;
          }
          return rowData;
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
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview.js')
    );
    
    // CSPのnonce生成
    const nonce = this.generateNonce();

    return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="
        default-src 'none';
        style-src ${webview.cspSource} https://fonts.googleapis.com 'unsafe-inline';
        script-src 'nonce-${nonce}';
        img-src ${webview.cspSource} data:;
        font-src https://fonts.gstatic.com;
    ">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">
    <title>CriticalWriting分析結果</title>
</head>
<body>
    <div id="app"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
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