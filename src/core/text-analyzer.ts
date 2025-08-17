import * as joyoKanji from 'joyo-kanji';

/**
 * 文字種の種類
 */
export enum CharacterType {
  /** ひらがな */
  Hiragana = 'hiragana',
  /** カタカナ */
  Katakana = 'katakana',
  /** 漢字 */
  Kanji = 'kanji',
  /** 英数字 */
  Alphanumeric = 'alphanumeric',
  /** その他（記号、空白など） */
  Others = 'others'
}

/**
 * 文字種分析結果
 */
export interface CharacterAnalysis {
  /** 各文字種の文字数 */
  counts: Record<CharacterType, number>;
  /** 各文字種の割合（0-1） */
  ratios: Record<CharacterType, number>;
  /** 総文字数 */
  totalChars: number;
  /** 常用漢字使用率（0-1） */
  joyoKanjiUsage: number;
  /** 常用漢字以外の漢字数 */
  nonJoyoKanjiCount: number;
}

/**
 * 文字種分析を行うクラス
 */
export class TextAnalyzer {
  private static joyoKanjiSet: Set<string> = new Set(joyoKanji);

  /**
   * テキストの文字種分析を行う
   * @param text 分析対象テキスト
   * @returns 文字種分析結果
   */
  static analyzeCharacters(text: string): CharacterAnalysis {
    const counts: Record<CharacterType, number> = {
      [CharacterType.Hiragana]: 0,
      [CharacterType.Katakana]: 0,
      [CharacterType.Kanji]: 0,
      [CharacterType.Alphanumeric]: 0,
      [CharacterType.Others]: 0
    };

    let joyoKanjiCount = 0;
    let totalKanjiCount = 0;

    // 文字ごとに分類
    for (const char of text) {
      const type = this.getCharacterType(char);
      counts[type]++;

      // 漢字の場合、常用漢字かどうかを判定
      if (type === CharacterType.Kanji) {
        totalKanjiCount++;
        if (this.joyoKanjiSet.has(char)) {
          joyoKanjiCount++;
        }
      }
    }

    const totalChars = text.length;
    const ratios: Record<CharacterType, number> = {} as Record<CharacterType, number>;

    // 各文字種の割合を計算
    for (const type of Object.values(CharacterType)) {
      ratios[type] = totalChars > 0 ? counts[type] / totalChars : 0;
    }

    // 常用漢字使用率を計算
    const joyoKanjiUsage = totalKanjiCount > 0 ? joyoKanjiCount / totalKanjiCount : 1.0;
    const nonJoyoKanjiCount = totalKanjiCount - joyoKanjiCount;

    return {
      counts,
      ratios,
      totalChars,
      joyoKanjiUsage,
      nonJoyoKanjiCount
    };
  }

  /**
   * 文字の種類を判定
   * @param char 判定対象文字
   * @returns 文字種
   */
  private static getCharacterType(char: string): CharacterType {
    const code = char.charCodeAt(0);

    // ひらがな（U+3041-U+3096）
    if (code >= 0x3041 && code <= 0x3096) {
      return CharacterType.Hiragana;
    }

    // カタカナ（U+30A1-U+30FA、U+30FC）
    if ((code >= 0x30A1 && code <= 0x30FA) || code === 0x30FC) {
      return CharacterType.Katakana;
    }

    // 漢字（CJK統合漢字: U+4E00-U+9FAF）
    if (code >= 0x4E00 && code <= 0x9FAF) {
      return CharacterType.Kanji;
    }

    // 英数字（ASCII英数字）
    if ((code >= 0x0030 && code <= 0x0039) || // 数字 0-9
        (code >= 0x0041 && code <= 0x005A) || // 大文字 A-Z
        (code >= 0x0061 && code <= 0x007A)) { // 小文字 a-z
      return CharacterType.Alphanumeric;
    }

    // 全角英数字
    if ((code >= 0xFF10 && code <= 0xFF19) || // 全角数字
        (code >= 0xFF21 && code <= 0xFF3A) || // 全角大文字
        (code >= 0xFF41 && code <= 0xFF5A)) { // 全角小文字
      return CharacterType.Alphanumeric;
    }

    // その他（記号、空白、句読点など）
    return CharacterType.Others;
  }

  /**
   * 複数の段落テキストをまとめて分析
   * @param texts テキスト配列
   * @returns 全体の分析結果
   */
  static analyzeParagraphs(texts: string[]): CharacterAnalysis {
    const combinedText = texts.join('');
    return this.analyzeCharacters(combinedText);
  }

  /**
   * 円グラフ表示用のデータを生成
   * @param analysis 文字種分析結果
   * @returns Chart.js用のデータ
   */
  static createPieChartData(analysis: CharacterAnalysis) {
    // 文字種バランス用
    const characterBalance = {
      labels: ['ひらがな', 'カタカナ', '漢字', '英数字', 'その他'],
      datasets: [{
        data: [
          analysis.counts[CharacterType.Hiragana],
          analysis.counts[CharacterType.Katakana],
          analysis.counts[CharacterType.Kanji],
          analysis.counts[CharacterType.Alphanumeric],
          analysis.counts[CharacterType.Others]
        ],
        backgroundColor: [
          '#FF6B6B', // ひらがな: 赤系
          '#4ECDC4', // カタカナ: 青緑系
          '#45B7D1', // 漢字: 青系
          '#96CEB4', // 英数字: 緑系
          '#FFEAA7'  // その他: 黄系
        ]
      }]
    };

    // 常用漢字使用率用
    const joyoKanjiUsage = {
      labels: ['常用漢字', '常用漢字以外'],
      datasets: [{
        data: [
          analysis.counts[CharacterType.Kanji] - analysis.nonJoyoKanjiCount,
          analysis.nonJoyoKanjiCount
        ],
        backgroundColor: [
          '#2ECC71', // 常用漢字: 緑
          '#E74C3C'  // 常用漢字以外: 赤
        ]
      }]
    };

    return {
      characterBalance,
      joyoKanjiUsage
    };
  }
}