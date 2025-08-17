import { Paragraph, Keyword } from '../core/types';
import { normalizeText } from '../core/utils';
import * as kuromoji from 'kuromoji';
import * as joyoKanji from 'joyo-kanji';

/**
 * キーワード抽出エンジン
 * kuromoji.jsによる形態素解析と常用漢字判定を使用して重要キーワードを抽出
 */
export class KeywordEngine {
  private stopWords: Set<string>;
  private keywordPatterns: RegExp[];
  private tokenizer: kuromoji.Tokenizer | null = null;
  private joyoKanjiSet: Set<string>;
  private isInitialized = false;

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

    // 常用漢字セットの初期化
    this.joyoKanjiSet = new Set(joyoKanji);

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
   * kuromojiトークナイザの初期化
   * @returns Promise<void>
   */
  private async initializeTokenizer(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    return new Promise((resolve, reject) => {
      kuromoji.builder({ dicPath: 'node_modules/kuromoji/dict' }).build((err, tokenizer) => {
        if (err) {
          console.error('[KeywordEngine] Failed to initialize kuromoji tokenizer:', err);
          reject(err);
          return;
        }
        
        this.tokenizer = tokenizer;
        this.isInitialized = true;
        console.log('[KeywordEngine] Kuromoji tokenizer initialized successfully');
        resolve();
      });
    });
  }

  /**
   * 常用漢字判定
   * @param text 判定対象のテキスト
   * @returns 常用漢字の使用率（0-1）
   */
  private calculateJoyoKanjiUsage(text: string): number {
    const kanjiMatches = text.match(/[\u4E00-\u9FAF]/g);
    if (!kanjiMatches || kanjiMatches.length === 0) {
      return 1.0; // 漢字がない場合は使用率100%とする
    }

    const joyoCount = kanjiMatches.filter(kanji => this.joyoKanjiSet.has(kanji)).length;
    return joyoCount / kanjiMatches.length;
  }

  /**
   * 複数段落からキーワードを抽出
   * @param paragraphs 段落一覧
   * @param mode 抽出モード
   * @returns 段落IDとキーワード配列のマップ
   */
  async extractKeywords(
    paragraphs: Paragraph[], 
    mode: 'rules' | 'tfidf' | 'embed' = 'rules'
  ): Promise<Map<string, Keyword[]>> {
    // kuromojiトークナイザを初期化
    await this.initializeTokenizer();
    
    const result = new Map<string, Keyword[]>();
    
    if (mode === 'rules') {
      // kuromoji形態素解析ベース抽出
      for (const paragraph of paragraphs) {
        const keywords = this.extractKeywordsByMorphologicalAnalysis(paragraph);
        result.set(paragraph.id, keywords);
      }
    } else {
      // 他のモード（tfidf, embed）は将来実装
      console.warn(`[KeywordEngine] Mode '${mode}' is not implemented yet. Using 'rules' mode.`);
      for (const paragraph of paragraphs) {
        const keywords = this.extractKeywordsByMorphologicalAnalysis(paragraph);
        result.set(paragraph.id, keywords);
      }
    }

    return result;
  }

  /**
   * kuromoji形態素解析ベースキーワード抽出
   * @param paragraph 対象段落
   * @returns キーワード配列
   */
  private extractKeywordsByMorphologicalAnalysis(paragraph: Paragraph): Keyword[] {
    if (!this.tokenizer) {
      console.warn('[KeywordEngine] Tokenizer not initialized, falling back to rule-based extraction');
      return this.extractKeywordsByRules(paragraph);
    }

    const normalizedText = normalizeText(paragraph.text);
    const tokens = this.tokenizer.tokenize(normalizedText);
    const candidates = new Map<string, { count: number; score: number; pos: string }>();

    // 形態素解析結果から名詞、動詞、形容詞、固有名詞を抽出
    for (const token of tokens) {
      const { surface_form, pos, pos_detail_1 } = token;
      
      // 品詞フィルタリング（名詞、動詞、形容詞、固有名詞）
      if (this.shouldIncludeMorpheme(pos, pos_detail_1, surface_form)) {
        const existing = candidates.get(surface_form);
        if (existing) {
          existing.count++;
          existing.score = this.calculateMorphemeScore(surface_form, existing.count, pos, pos_detail_1);
        } else {
          const score = this.calculateMorphemeScore(surface_form, 1, pos, pos_detail_1);
          candidates.set(surface_form, { count: 1, score, pos: `${pos}-${pos_detail_1}` });
        }
      }
    }

    // 結果を構築
    const keywords: Keyword[] = [];
    for (const [text, data] of candidates.entries()) {
      // 常用漢字以外の漢字を含む固有名詞は除外（仕様要件）
      if (data.pos.includes('固有名詞') && this.calculateJoyoKanjiUsage(text) < 0.8) {
        continue;
      }

      keywords.push({
        text,
        score: data.score,
        frequency: data.count,
        partOfSpeech: data.pos
      });
    }

    // スコア順でソート
    return keywords.sort((a, b) => b.score - a.score).slice(0, 20);
  }

  /**
   * 形態素が含めるべきかどうかを判定
   * @param pos 品詞
   * @param posDetail 品詞詳細
   * @param surface 表層形
   * @returns 含めるべきかどうか
   */
  private shouldIncludeMorpheme(pos: string, posDetail: string, surface: string): boolean {
    // ストップワードチェック
    if (this.stopWords.has(surface)) {
      return false;
    }

    // 短すぎる語は除外
    if (surface.length < 2) {
      return false;
    }

    // 品詞による判定
    if (pos === '名詞') {
      // 一般名詞、固有名詞、サ変接続名詞を含める
      return posDetail === '一般' || posDetail === '固有名詞' || posDetail === 'サ変接続';
    }
    
    if (pos === '動詞') {
      // 自立動詞のみ
      return posDetail === '自立';
    }
    
    if (pos === '形容詞') {
      // 自立形容詞のみ
      return posDetail === '自立';
    }

    return false;
  }

  /**
   * 形態素のスコアを計算
   * @param surface 表層形
   * @param count 出現回数
   * @param pos 品詞
   * @param posDetail 品詞詳細
   * @returns スコア
   */
  private calculateMorphemeScore(surface: string, count: number, pos: string, posDetail: string): number {
    let score = count * 0.5; // 基本スコア

    // 品詞による重み付け
    if (pos === '名詞') {
      if (posDetail === '固有名詞') {
        score *= 1.5;
      } else if (posDetail === 'サ変接続') {
        score *= 1.3;
      }
    }

    // 長さによる重み付け
    if (surface.length >= 4) {
      score *= 1.2;
    }

    // カタカナ語の重み付け
    if (/^[\u30A1-\u30FA\u30FC]+$/.test(surface)) {
      score *= 1.1;
    }

    return score;
  }

  /**
   * ルールベースキーワード抽出（フォールバック用）
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