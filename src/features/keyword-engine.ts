import * as vscode from 'vscode';
import { Paragraph, Keyword } from '../core/types';
import { extractWithFlashText } from './flashtext-bridge';

/**
 * キーワード抽出エンジン
 * FlashTextを使用して重要キーワードを抽出
 */
export class KeywordEngine {
  private context: vscode.ExtensionContext | null = null;

  constructor() {
    // コンストラクタは空で良い
  }

  /**
   * 拡張機能のコンテキストをセット
   * @param context 拡張機能コンテキスト
   */
  public initialize(context: vscode.ExtensionContext): void {
    this.context = context;
  }

  /**
   * 複数段落からキーワードを抽出
   * @param paragraphs 段落一覧
   * @returns 段落IDとキーワード配列のマップ
   */
  async extractKeywords(
    paragraphs: Paragraph[]
  ): Promise<Map<string, Keyword[]>> {
    try {
      // FlashTextによる抽出を直接呼び出す
      const flashRes = await extractWithFlashText(paragraphs, this.context || undefined);
      return flashRes;
    } catch (e) {
      console.error('[KeywordEngine] FlashText based keyword extraction failed:', e);
      // エラーが発生した場合、ユーザーに通知し、空のマップを返す
      vscode.window.showErrorMessage('キーワード抽出に失敗しました。');
      return new Map<string, Keyword[]>();
    }
  }
}

/**
 * シングルトンインスタンス
 */
export const keywordEngine = new KeywordEngine();