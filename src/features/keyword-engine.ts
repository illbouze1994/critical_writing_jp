import { Paragraph, Keyword } from '../core/types';
import { normalizeText } from '../core/utils';

/**
 * キーワード抽出エンジン
 * 形態素解析と独自ルールベースで重要キーワードを抽出
 */
export class KeywordEngine {
  private stopWords: Set<string>;
  private keywordPatterns: RegExp[];

  constructor() {
    // 日本語ストップワード（一般的すぎる語彙を除外）
    this.stopWords = new Set([
      // 助詞
      'が', 'を', 'に', 'へ', 'と', 'から', 'より', 'で', 'は', 'も', 'の', 'や',
      // 助動詞
      'だ', 'である', 'です', 'ます', 'した', 'する', 'される', 'れる', 'らる',
      // 一般的な語彙
      'こと', 'もの', 'ため', 'よう', 'そう', 'とき', 'ところ', '場合', '際',
      '一方', '他方', 'また', 'さらに', 'しかし', 'ただし', 'なお', 'また',
      'その', 'この', 'それ', 'これ', 'あの', 'どの', 'など', 'なと'
    ]);

    // キーワード候補となるパターン
    this.keywordPatterns = [
      // カタカナ語（技術用語が多い）
      /[\u30A1-\u30FA\u30FC]+/g,
      // 英数字を含む語
      /[A-Za-z0-9]+/g,
      // 専門用語らしき複合語（ひらがな以外で3文字以上）
      /[^\u3041-\u3096\s\u3000]{3,}/g,
      // 「〜性」「〜化」「〜的」「〜論」などの学術用語的語尾
      /[\u4E00-\u9FAF]+[性化的論法則系]/g
    ];
  }

  /**
   * 複数段落からキーワードを抽出
   * @param paragraphs 段落一覧
   * @param mode 抽出モード（現在は'rules'のみ実装）
   * @returns 段落IDとキーワード配列のマップ
   */
  async extractKeywords(
    paragraphs: Paragraph[], 
    mode: 'rules' | 'tfidf' | 'embed' = 'rules'
  ): Promise<Map<string, Keyword[]>> {
    const result = new Map<string, Keyword[]>();
    
    if (mode === 'rules') {
      // ルールベース抽出
      for (const paragraph of paragraphs) {
        const keywords = this.extractKeywordsByRules(paragraph);
        result.set(paragraph.id, keywords);
      }
    } else {
      // 他のモード（tfidf, embed）は将来実装
      console.warn(`[KeywordEngine] Mode '${mode}' is not implemented yet. Using 'rules' mode.`);
      for (const paragraph of paragraphs) {
        const keywords = this.extractKeywordsByRules(paragraph);
        result.set(paragraph.id, keywords);
      }
    }

    return result;
  }

  /**
   * ルールベースキーワード抽出
   * @param paragraph 対象段落
   * @returns キーワード配列
   */
  private extractKeywordsByRules(paragraph: Paragraph): Keyword[] {
    const normalizedText = normalizeText(paragraph.text);
    const candidates = new Map<string, { count: number; score: number }>();

    // パターンマッチングで候補を抽出
    for (const pattern of this.keywordPatterns) {
      const matches = normalizedText.matchAll(pattern);
      
      for (const match of matches) {
        const keyword = match[0].trim();
        
        // フィルタリング
        if (this.shouldIncludeKeyword(keyword)) {
          const existing = candidates.get(keyword);
          if (existing) {
            existing.count++;
            existing.score = this.calculateKeywordScore(keyword, existing.count);
          } else {
            const score = this.calculateKeywordScore(keyword, 1);
            candidates.set(keyword, { count: 1, score });
          }
        }
      }
    }

    // 簡易形態素解析風処理（名詞句の抽出）
    this.extractNounPhrases(normalizedText, candidates);

    // 結果を構築
    const keywords: Keyword[] = [];
    for (const [text, data] of candidates.entries()) {
      keywords.push({
        text,
        score: data.score,
        frequency: data.count,
        partOfSpeech: this.guessPartOfSpeech(text)
      });
    }

    // スコア順でソートし、上位を返す
    return keywords
      .sort((a, b) => b.score - a.score)
      .slice(0, 10); // 段落あたり最大10個のキーワード
  }

  /**
   * キーワードとして採用するかの判定
   * @param keyword 候補キーワード
   * @returns 採用可否
   */
  private shouldIncludeKeyword(keyword: string): boolean {
    // 長さチェック
    if (keyword.length < 2 || keyword.length > 20) {
      return false;
    }

    // ストップワード除外
    if (this.stopWords.has(keyword)) {
      return false;
    }

    // 数字のみは除外
    if (/^\d+$/.test(keyword)) {
      return false;
    }

    // 記号のみは除外
    if (/^[^\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u4E00-\u9FAF\uFF66-\uFF9FA-Za-z0-9]+$/.test(keyword)) {
      return false;
    }

    return true;
  }

  /**
   * キーワードスコアの計算
   * @param keyword キーワード
   * @param frequency 出現頻度
   * @returns スコア（0-1の範囲）
   */
  private calculateKeywordScore(keyword: string, frequency: number): number {
    let score = 0;

    // 基本スコア（頻度ベース）
    score += Math.min(frequency * 0.1, 0.3);

    // 長さボーナス（4-8文字が理想）
    const length = keyword.length;
    if (length >= 4 && length <= 8) {
      score += 0.2;
    } else if (length >= 2 && length <= 12) {
      score += 0.1;
    }

    // カタカナ語ボーナス（専門用語の可能性）
    if (/^[\u30A1-\u30FA\u30FC]+$/.test(keyword)) {
      score += 0.2;
    }

    // 英語混在ボーナス
    if (/[A-Za-z]/.test(keyword)) {
      score += 0.15;
    }

    // 学術用語語尾ボーナス
    if (/[性化的論法則系]$/.test(keyword)) {
      score += 0.15;
    }

    return Math.min(score, 1.0);
  }

  /**
   * 名詞句の抽出（簡易版）
   * @param text テキスト
   * @param candidates 候補マップ
   */
  private extractNounPhrases(text: string, candidates: Map<string, { count: number; score: number }>): void {
    // 漢字の連続を名詞句候補として抽出
    const nounPattern = /[\u4E00-\u9FAF]{2,8}/g;
    const matches = text.matchAll(nounPattern);

    for (const match of matches) {
      const phrase = match[0];
      
      if (this.shouldIncludeKeyword(phrase)) {
        const existing = candidates.get(phrase);
        if (existing) {
          existing.count++;
          existing.score = this.calculateKeywordScore(phrase, existing.count);
        } else {
          const score = this.calculateKeywordScore(phrase, 1);
          candidates.set(phrase, { count: 1, score });
        }
      }
    }
  }

  /**
   * 品詞の推定（簡易版）
   * @param keyword キーワード
   * @returns 推定品詞
   */
  private guessPartOfSpeech(keyword: string): string {
    // カタカナ語
    if (/^[\u30A1-\u30FA\u30FC]+$/.test(keyword)) {
      return '名詞（カタカナ）';
    }

    // 英語
    if (/^[A-Za-z0-9]+$/.test(keyword)) {
      return '名詞（英語）';
    }

    // 学術用語語尾
    if (/[性化的論法則系]$/.test(keyword)) {
      return '名詞（専門用語）';
    }

    // 漢字
    if (/^[\u4E00-\u9FAF]+$/.test(keyword)) {
      return '名詞（漢字）';
    }

    return '名詞';
  }
}

/**
 * シングルトンインスタンス
 */
export const keywordEngine = new KeywordEngine();