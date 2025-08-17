import { Paragraph, Keyword, Scores } from '../core/types';
import { normalizeText } from '../core/utils';

/**
 * ROI (重要度) 計算エンジン
 * 仕様書に従い、以下の線形結合でROIスコアを算出：
 * ROI(p) = w1 * KeywordDensity(p) + w2 * DiscourseMarkerScore(p) + w3 * CitationDensity(p) + w4 * LexicalDensity(p)
 */
export class ROIEngine {
  private discourseMarkers: Set<string>;
  private citationPatterns: RegExp[];
  private contentWords: RegExp[];

  constructor() {
    // 日本語のディスコースマーカー（論旨展開語）
    this.discourseMarkers = new Set([
      // 対比・対照
      'しかし', 'ただし', 'けれども', 'しかしながら', 'ところが', 'もっとも',
      '一方', '他方', 'これに対して', '反面', '逆に',
      
      // 因果関係
      'したがって', 'よって', 'ゆえに', 'それゆえ', 'そのため', 'こうして',
      'その結果', 'このように', '従来', '以上により',
      
      // 追加・補強
      'さらに', 'また', '加えて', 'なお', 'ちなみに', '特に', 'とりわけ',
      'すなわち', 'つまり', '要するに', '言い換えれば',
      
      // 例示
      '例えば', 'たとえば', '具体的には', 'すなわち', 'いわば',
      
      // 総括・結論
      '以上', '総じて', '要約すると', '結論として', '最後に', '最終的に'
    ]);

    // 引用パターン（日本語学術文書向け）
    this.citationPatterns = [
      // 【】形式の引用
      /【[^】]+】/g,
      // （著者 年）形式
      /（[^）]+\s+\d{4}[^）]*）/g,
      // (Author Year)形式
      /\([A-Za-z][^)]+\s+\d{4}[^)]*\)/g,
      // 「」での引用
      /「[^」]{10,}」/g,
      // 注釈番号
      /\*\d+|注\d+|（注\d+）/g
    ];

    // 内容語のパターン（機能語と区別するため）
    this.contentWords = [
      // 名詞・動詞・形容詞の語尾パターン
      /[\u4E00-\u9FAF]{2,}/g, // 漢字2文字以上
      /[\u30A1-\u30FA\u30FC]{2,}/g, // カタカナ2文字以上
      /[A-Za-z]{3,}/g // 英語3文字以上
    ];
  }

  /**
   * 複数段落のROIスコアを計算
   * @param paragraphs 段落一覧
   * @param keywords 段落IDとキーワードのマップ
   * @param weights ROI重み係数
   * @returns 段落IDとスコア情報のマップ
   */
  calculateROI(
    paragraphs: Paragraph[],
    keywords: Map<string, Keyword[]>,
    weights: { w1: number; w2: number; w3: number; w4: number }
  ): Map<string, Scores> {
    const result = new Map<string, Scores>();

    for (const paragraph of paragraphs) {
      const paragraphKeywords = keywords.get(paragraph.id) || [];
      const score = this.calculateParagraphROI(paragraph, paragraphKeywords, weights);
      result.set(paragraph.id, score);
    }

    return result;
  }

  /**
   * 単一段落のROIスコア計算
   * @param paragraph 対象段落
   * @param keywords 段落のキーワード一覧
   * @param weights 重み係数
   * @returns スコア情報
   */
  private calculateParagraphROI(
    paragraph: Paragraph,
    keywords: Keyword[],
    weights: { w1: number; w2: number; w3: number; w4: number }
  ): Scores {
    const normalizedText = normalizeText(paragraph.text);
    
    // 各要素のスコアを計算
    const keywordDensity = this.calculateKeywordDensity(normalizedText, keywords);
    const discourseMarkerScore = this.calculateDiscourseMarkerScore(normalizedText);
    const citationDensity = this.calculateCitationDensity(normalizedText);
    const lexicalDensity = this.calculateLexicalDensity(normalizedText);

    // ROI計算（線形結合）
    const roi = 
      weights.w1 * keywordDensity +
      weights.w2 * discourseMarkerScore +
      weights.w3 * citationDensity +
      weights.w4 * lexicalDensity;

    // スコア詳細を保存（デバッグ・説明用）
    const explain: Record<string, number> = {
      keywordDensity: keywordDensity,
      discourseMarkerScore: discourseMarkerScore,
      citationDensity: citationDensity,
      lexicalDensity: lexicalDensity,
      w1_contribution: weights.w1 * keywordDensity,
      w2_contribution: weights.w2 * discourseMarkerScore,
      w3_contribution: weights.w3 * citationDensity,
      w4_contribution: weights.w4 * lexicalDensity
    };

    return {
      roi: Math.min(Math.max(roi, 0), 1), // 0-1の範囲に正規化
      lexicalDensity,
      citationDensity,
      explain
    };
  }

  /**
   * キーワード密度の計算
   * @param text 正規化済みテキスト
   * @param keywords キーワード一覧
   * @returns キーワード密度（0-1）
   */
  private calculateKeywordDensity(text: string, keywords: Keyword[]): number {
    if (keywords.length === 0 || text.length === 0) {
      return 0;
    }

    // キーワードの総スコア重みと文字数から密度を算出
    const totalKeywordScore = keywords.reduce((sum, kw) => sum + kw.score, 0);
    const maxPossibleScore = keywords.length * 1.0; // 最大スコアは1.0 * キーワード数

    // 密度 = 実際のキーワードスコア合計 / (文字数の平方根 * 正規化係数)
    const density = totalKeywordScore / (Math.sqrt(text.length) * 0.1);
    
    return Math.min(density, 1.0);
  }

  /**
   * ディスコースマーカースコアの計算
   * @param text 正規化済みテキスト
   * @returns ディスコースマーカースコア（0-1）
   */
  private calculateDiscourseMarkerScore(text: string): number {
    let markerCount = 0;
    let totalMarkerWeight = 0;

    // 各ディスコースマーカーの出現をカウント
    for (const marker of this.discourseMarkers) {
      const occurrences = (text.match(new RegExp(marker, 'g')) || []).length;
      if (occurrences > 0) {
        markerCount += occurrences;
        
        // マーカーの種類による重み付け
        let weight = 1.0;
        if (['したがって', 'よって', 'そのため'].includes(marker)) {
          weight = 1.5; // 因果関係マーカーは重要度高
        } else if (['しかし', 'ただし', 'しかしながら'].includes(marker)) {
          weight = 1.3; // 対比マーカーも重要
        }
        
        totalMarkerWeight += occurrences * weight;
      }
    }

    if (markerCount === 0) {
      return 0;
    }

    // 文章長に対するマーカー密度を計算
    const markerDensity = totalMarkerWeight / Math.max(text.length / 100, 1); // 100文字あたりの密度
    
    return Math.min(markerDensity * 0.5, 1.0); // 調整係数0.5で適切な範囲に
  }

  /**
   * 引用密度の計算
   * @param text 正規化済みテキスト
   * @returns 引用密度（0-1）
   */
  private calculateCitationDensity(text: string): number {
    let citationCount = 0;
    let totalCitationLength = 0;

    // 各引用パターンをチェック
    for (const pattern of this.citationPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        citationCount++;
        totalCitationLength += match[0].length;
      }
    }

    if (citationCount === 0) {
      return 0;
    }

    // 引用の数と文字数を考慮した密度
    const density = (citationCount * 0.3) + (totalCitationLength / text.length * 0.7);
    
    return Math.min(density, 1.0);
  }

  /**
   * 語彙密度の計算
   * @param text 正規化済みテキスト
   * @returns 語彙密度（0-1）
   */
  private calculateLexicalDensity(text: string): number {
    if (text.length === 0) {
      return 0;
    }

    let contentWordCount = 0;
    let totalContentLength = 0;

    // 内容語のパターンマッチング
    for (const pattern of this.contentWords) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        contentWordCount++;
        totalContentLength += match[0].length;
      }
    }

    if (contentWordCount === 0) {
      return 0;
    }

    // 内容語の密度（内容語の文字数 / 全体の文字数）
    const density = totalContentLength / text.length;
    
    // 日本語は機能語も多いため、調整係数を適用
    return Math.min(density * 1.2, 1.0);
  }
}

/**
 * シングルトンインスタンス
 */
export const roiEngine = new ROIEngine();