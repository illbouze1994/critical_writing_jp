/**
 * UI装飾機能の実装
 * エディタ内の段落ハイライトとステータスバー表示を管理する
 */

import * as vscode from 'vscode';
import { Paragraph, ParagraphType } from '../core/types';
import { ParagraphAnalysisResult } from '../core/paragraph-analyzer';
import { Settings } from '../platform/settings';

/**
 * 段落の装飾タイプ
 */
export enum DecorationStyle {
  /** 文字数が閾値を超過している段落 */
  OverThreshold = 'overThreshold',
  
  /** 文字数が閾値未満の段落 */
  UnderThreshold = 'underThreshold',
  
  /** 正常範囲内の段落 */
  Normal = 'normal',
  
  /** 見出し段落 */
  Heading = 'heading',
  
  /** 引用段落 */
  Quote = 'quote',
  
  /** 高ROIスコアの段落 */
  HighROI = 'highROI',
  
  /** キーワードハイライト */
  Keyword = 'keyword'
}

/**
 * ステータス情報
 */
interface StatusInfo {
  /** オンライン/オフライン状態 */
  isOnline: boolean;
  
  /** LLM機能有効状態 */
  llmEnabled: boolean;
  
  /** Google Books API設定状態 */
  booksApiConfigured: boolean;
  
  /** 総段落数 */
  totalParagraphs: number;
  
  /** 問題のある段落数 */
  issueCount: number;
}

/**
 * UI装飾管理クラス
 */
export class UIDecorations {
  private static instance: UIDecorations | null = null;
  
  // 装飾タイプ定義
  private decorationTypes = new Map<DecorationStyle, vscode.TextEditorDecorationType>();
  
  // ステータスバーアイテム
  private statusBarItems = new Map<string, vscode.StatusBarItem>();
  
  // 現在の装飾状態
  private currentDecorations = new Map<string, DecorationStyle[]>();

  private constructor(private context: vscode.ExtensionContext) {
    this.initializeDecorationTypes();
    this.initializeStatusBarItems();
  }

  /**
   * シングルトンインスタンスを取得
   */
  static getInstance(context: vscode.ExtensionContext): UIDecorations {
    if (!UIDecorations.instance) {
      UIDecorations.instance = new UIDecorations(context);
    }
    return UIDecorations.instance;
  }

  /**
   * 装飾タイプの初期化
   */
  private initializeDecorationTypes(): void {
    const settings = new Settings();

    // 文字数超過段落の装飾
    this.decorationTypes.set(DecorationStyle.OverThreshold, vscode.window.createTextEditorDecorationType({
      backgroundColor: new vscode.ThemeColor('editorWarning.background'),
      border: '1px solid',
      borderColor: new vscode.ThemeColor('editorWarning.foreground'),
      isWholeLine: true,
      overviewRulerColor: new vscode.ThemeColor('editorWarning.foreground'),
      overviewRulerLane: vscode.OverviewRulerLane.Right,
      after: {
        contentText: ' 📏 長すぎ',
        color: new vscode.ThemeColor('editorWarning.foreground'),
        fontWeight: 'bold'
      }
    }));

    // 文字数不足段落の装飾
    this.decorationTypes.set(DecorationStyle.UnderThreshold, vscode.window.createTextEditorDecorationType({
      backgroundColor: new vscode.ThemeColor('editorInfo.background'),
      border: '1px solid',
      borderColor: new vscode.ThemeColor('editorInfo.foreground'),
      isWholeLine: true,
      overviewRulerColor: new vscode.ThemeColor('editorInfo.foreground'),
      overviewRulerLane: vscode.OverviewRulerLane.Right,
      after: {
        contentText: ' 📏 短すぎ',
        color: new vscode.ThemeColor('editorInfo.foreground'),
        fontWeight: 'bold'
      }
    }));

    // 正常段落の装飾（軽微な境界線のみ）
    this.decorationTypes.set(DecorationStyle.Normal, vscode.window.createTextEditorDecorationType({
      border: '2px solid',
      borderColor: new vscode.ThemeColor('editorInfo.foreground'),
      opacity: '0.3'
    }));

    // 見出し段落の装飾
    this.decorationTypes.set(DecorationStyle.Heading, vscode.window.createTextEditorDecorationType({
      fontWeight: 'bold',
      textDecoration: 'underline',
      after: {
        contentText: ' 📋',
        color: new vscode.ThemeColor('textPreformat.foreground')
      }
    }));

    // 引用段落の装飾
    this.decorationTypes.set(DecorationStyle.Quote, vscode.window.createTextEditorDecorationType({
      border: '4px solid',
      borderColor: new vscode.ThemeColor('textBlockQuote.border'),
      backgroundColor: new vscode.ThemeColor('textBlockQuote.background'),
      after: {
        contentText: ' 💬',
        color: new vscode.ThemeColor('textBlockQuote.border')
      }
    }));

    // 高ROI段落の装飾
    this.decorationTypes.set(DecorationStyle.HighROI, vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(255, 215, 0, 0.1)', // 薄い金色
      border: '1px solid gold',
      after: {
        contentText: ' ⭐',
        color: 'gold',
        fontWeight: 'bold'
      }
    }));

    // キーワードハイライト装飾
    this.decorationTypes.set(DecorationStyle.Keyword, vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(255, 255, 0, 0.3)', // 薄い黄色
      border: '1px solid rgba(255, 215, 0, 0.8)',
      borderRadius: '2px',
      overviewRulerColor: 'rgba(255, 215, 0, 0.8)',
      overviewRulerLane: vscode.OverviewRulerLane.Center
    }));
  }

  /**
   * ステータスバーアイテムの初期化
   */
  private initializeStatusBarItems(): void {
    // 接続状態インジケータ
    const connectionStatus = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right, 
      100
    );
    connectionStatus.command = 'criticalWritingJp.togglePanel';
    this.statusBarItems.set('connection', connectionStatus);

    // 段落統計インジケータ
    const paragraphStats = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right, 
      99
    );
    paragraphStats.command = 'criticalWritingJp.togglePanel';
    this.statusBarItems.set('stats', paragraphStats);

    // LLM状態インジケータ
    const llmStatus = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right, 
      98
    );
    llmStatus.command = 'criticalWritingJp.enableLLM';
    this.statusBarItems.set('llm', llmStatus);

    // Google Books状態インジケータ
    const booksStatus = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right, 
      97
    );
    booksStatus.command = 'criticalWritingJp.configureGoogleBooksKey';
    this.statusBarItems.set('books', booksStatus);

    // ステータスバーアイテムをコンテキストに追加
    this.statusBarItems.forEach(item => {
      this.context.subscriptions.push(item);
    });
  }

  /**
   * 分析結果に基づいて装飾を更新
   */
  async updateDecorations(
    editor: vscode.TextEditor,
    result: ParagraphAnalysisResult,
    llmResults?: Map<string, any>
  ): Promise<void> {
    if (!editor || (editor.document.languageId !== 'markdown' && editor.document.languageId !== 'plaintext')) {
      return;
    }

    const settings = new Settings();
    const { min: minThreshold, max: maxThreshold } = settings.counting.threshold;

    // 装飾マップをクリア
    this.clearCurrentDecorations(editor);

    // 段落ごとの装飾を決定
    const decorationRanges = new Map<DecorationStyle, vscode.Range[]>();

    result.paragraphs.forEach(paragraph => {
      const range = new vscode.Range(
        editor.document.positionAt(paragraph.range.start),
        editor.document.positionAt(paragraph.range.end)
      );

      // 段落タイプに基づく基本装飾
      let primaryStyle: DecorationStyle;

      if (paragraph.type === ParagraphType.Heading) {
        primaryStyle = DecorationStyle.Heading;
      } else if (paragraph.type === ParagraphType.Quote) {
        primaryStyle = DecorationStyle.Quote;
      } else if (paragraph.chars > maxThreshold) {
        primaryStyle = DecorationStyle.OverThreshold;
      } else if (paragraph.chars < minThreshold) {
        primaryStyle = DecorationStyle.UnderThreshold;
      } else {
        primaryStyle = DecorationStyle.Normal;
      }

      // 装飾範囲を追加
      if (!decorationRanges.has(primaryStyle)) {
        decorationRanges.set(primaryStyle, []);
      }
      decorationRanges.get(primaryStyle)!.push(range);

      // 高ROIスコアの追加装飾
      const roiScore = paragraph.features?.roi || 0;
      if (roiScore > 0.8) {
        if (!decorationRanges.has(DecorationStyle.HighROI)) {
          decorationRanges.set(DecorationStyle.HighROI, []);
        }
        decorationRanges.get(DecorationStyle.HighROI)!.push(range);
      }
    });

    // 装飾を適用
    decorationRanges.forEach((ranges, style) => {
      const decorationType = this.decorationTypes.get(style);
      if (decorationType) {
        editor.setDecorations(decorationType, ranges);
      }
    });

    // 状態記録
    this.currentDecorations.set(editor.document.uri.toString(), Array.from(decorationRanges.keys()));
  }

  /**
   * 現在の装飾をクリア
   */
  private clearCurrentDecorations(editor: vscode.TextEditor): void {
    const documentUri = editor.document.uri.toString();
    const currentStyles = this.currentDecorations.get(documentUri);

    if (currentStyles) {
      currentStyles.forEach(style => {
        const decorationType = this.decorationTypes.get(style);
        if (decorationType) {
          editor.setDecorations(decorationType, []);
        }
      });
    }

    this.currentDecorations.delete(documentUri);
  }

  /**
   * ステータスバーを更新
   */
  updateStatusBar(status: StatusInfo): void {
    // 接続状態の更新
    const connectionItem = this.statusBarItems.get('connection');
    if (connectionItem) {
      if (status.isOnline) {
        connectionItem.text = 'オンライン';
        connectionItem.color = new vscode.ThemeColor('statusBar.foreground');
        connectionItem.tooltip = 'CriticalWritingJp: オンライン機能が利用可能です';
      } else {
        connectionItem.text = 'オフライン';
        connectionItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
        connectionItem.tooltip = 'CriticalWritingJp: オフラインモードで動作中';
      }
      connectionItem.show();
    }

    // 段落統計の更新
    const statsItem = this.statusBarItems.get('stats');
    if (statsItem) {
      statsItem.text = `${status.totalParagraphs}段落`;
      if (status.issueCount > 0) {
        statsItem.text += ` (${status.issueCount})`;
        statsItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
      } else {
        statsItem.color = new vscode.ThemeColor('statusBar.foreground');
      }
      statsItem.tooltip = `総段落数: ${status.totalParagraphs}, 問題: ${status.issueCount}`;
      statsItem.show();
    }

    // LLM状態の更新
    const llmItem = this.statusBarItems.get('llm');
    if (llmItem) {
      if (status.llmEnabled) {
        llmItem.text = 'LLM有効';
        llmItem.color = new vscode.ThemeColor('statusBarItem.prominentForeground');
        llmItem.tooltip = 'LLM機能が有効です。クリックして設定を変更';
      } else {
        llmItem.text = 'LLM無効';
        llmItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
        llmItem.tooltip = 'LLM機能が無効です。クリックして有効化';
      }
      llmItem.show();
    }

    // Google Books状態の更新
    const booksItem = this.statusBarItems.get('books');
    if (booksItem) {
      if (status.booksApiConfigured) {
        booksItem.text = '📚 Books有効';
        booksItem.color = new vscode.ThemeColor('statusBarItem.prominentForeground');
        booksItem.tooltip = 'Google Books APIが設定済みです';
      } else {
        booksItem.text = '📚 Books無効';
        booksItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
        booksItem.tooltip = 'Google Books APIキーが未設定です。クリックして設定';
      }
      booksItem.show();
    }
  }

  /**
   * ステータスバーを非表示
   */
  hideStatusBar(): void {
    this.statusBarItems.forEach(item => {
      item.hide();
    });
  }

  /**
   * 特定の段落を強調表示（ジャンプ時）
   */
  async highlightParagraph(editor: vscode.TextEditor, paragraphId: string): Promise<void> {
    // 段落IDから位置を特定（実装では段落キャッシュから検索）
    // ここでは簡略化
    
    const highlightDecoration = vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(255, 255, 0, 0.3)', // 黄色のハイライト
      border: '2px solid yellow',
      isWholeLine: true
    });

    // 一時的に強調表示（3秒後に削除）
    setTimeout(() => {
      highlightDecoration.dispose();
    }, 3000);

    console.log(`[UIDecorations] Highlighted paragraph: ${paragraphId}`);
  }

  /**
   * カラーテーマの変更に対応
   */
  private onDidChangeColorTheme(): void {
    // テーマが変わった場合、装飾タイプを再初期化
    this.decorationTypes.forEach(decoration => {
      decoration.dispose();
    });
    this.decorationTypes.clear();
    this.initializeDecorationTypes();
  }

  /**
   * キーワードハイライトを適用
   * @param editor エディタ
   * @param keywords キーワードマップ
   */
  async applyKeywordHighlights(editor: vscode.TextEditor, keywords: Map<string, any[]>): Promise<void> {
    try {
      if (!editor || !keywords || keywords.size === 0) {
        // console.log('[UIDecorations] No keywords available for highlighting');
        return;
      }

      const decorationType = this.decorationTypes.get(DecorationStyle.Keyword);
      if (!decorationType) {
        console.error('[UIDecorations] Keyword decoration type not found');
        return;
      }

      const ranges: vscode.Range[] = [];
      const documentText = editor.document.getText();

      // 各段落のキーワードをハイライト
      keywords.forEach((keywordList, paragraphId) => {
        keywordList.forEach(keyword => {
          const keywordText = keyword.text || keyword;
          if (!keywordText) return;

          // キーワードのすべての出現箇所を検索
          const regex = new RegExp(this.escapeRegex(keywordText), 'gi');
          let match;
          while ((match = regex.exec(documentText)) !== null) {
            const startPos = editor.document.positionAt(match.index);
            const endPos = editor.document.positionAt(match.index + keywordText.length);
            ranges.push(new vscode.Range(startPos, endPos));
          }
        });
      });

      // キーワードハイライトを適用
      editor.setDecorations(decorationType, ranges);
      // console.log(`[UIDecorations] Applied keyword highlights: ${ranges.length} keywords`);
    } catch (error) {
      console.error('[UIDecorations] Error applying keyword highlights:', error);
    }
  }

  /**
   * キーワードハイライトをクリア
   * @param editor エディタ
   */
  async clearKeywordHighlights(editor: vscode.TextEditor): Promise<void> {
    if (!editor) {
      return;
    }
    const decorationType = this.decorationTypes.get(DecorationStyle.Keyword);
    if (decorationType) {
      try {
        editor.setDecorations(decorationType, []);
        // console.log('[UIDecorations] Cleared keyword highlights');
      } catch (error) {
        console.error('[UIDecorations] Error clearing keyword highlights:', error);
      }
    }
  }

  /**
   * 正規表現用にエスケープ
   * @param text エスケープするテキスト
   */
  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * リソースの破棄
   */
  dispose(): void {
    // 装飾タイプの破棄
    this.decorationTypes.forEach(decoration => {
      decoration.dispose();
    });
    this.decorationTypes.clear();

    // ステータスバーアイテムの破棄
    this.statusBarItems.forEach(item => {
      item.dispose();
    });
    this.statusBarItems.clear();

    // 装飾状態をクリア
    this.currentDecorations.clear();

    UIDecorations.instance = null;
  }
}

/**
 * UI装飾の初期化とアクティブエディタ監視
 */
export function initializeUIDecorations(context: vscode.ExtensionContext): vscode.Disposable {
  const decorations = UIDecorations.getInstance(context);

  // アクティブエディタの変更監視
  const disposable = vscode.window.onDidChangeActiveTextEditor(async (editor) => {
    if (!editor || editor.document.languageId !== 'markdown') {
      decorations.hideStatusBar();
      return;
    }

    // 初期状態の表示
    decorations.updateStatusBar({
      isOnline: false,
      llmEnabled: false,
      booksApiConfigured: false,
      totalParagraphs: 0,
      issueCount: 0
    });
  });

  return {
    dispose: () => {
      disposable.dispose();
      decorations.dispose();
    }
  };
}