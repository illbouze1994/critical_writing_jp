/**
 * 段落解析エンジン
 * Markdownテキストから段落を検出し、文字数カウントと特徴量抽出を行う
 */

import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { Paragraph, ParagraphType } from './types';
import { TextAnalyzer } from './text-analyzer';

/**
 * Markdownブロックの種類を判定するための正規表現
 */
const MARKDOWN_PATTERNS = {
  // 見出し（# から ######）
  heading: /^#{1,6}\s+(.+)$/m,
  
  // リスト項目（- * + や数字付きリスト）
  listItem: /^(\s*)[-*+]\s+(.+)$|^(\s*)\d+\.\s+(.+)$/m,
  
  // 引用ブロック（>で始まる）
  quote: /^>\s*(.*)$/m,
  
  // コードブロック（```で囲まれた部分）
  codeBlock: /^```[\s\S]*?```$/m,
  
  // インラインコード（`で囲まれた部分）
  inlineCode: /`[^`]+`/g,
  
  // 脚注（[^id]: の形式）
  footnote: /^\[\^([^\]]+)\]:\s*(.+)$/m,
  
  // 水平線（--- や ***）
  horizontalRule: /^[-*_]{3,}$/m,
  
  // 空行
  emptyLine: /^\s*$/
};

/**
 * 段落解析の設定
 */
export interface ParagraphAnalysisOptions {
  /** 引用ブロック内のテキストを解析対象に含めるか */
  includeQuotes?: boolean;
  
  /** コードブロック内のテキストを解析対象に含めるか */
  includeCodeBlocks?: boolean;
  
  /** 脚注内のテキストを解析対象に含めるか */
  includeFootnotes?: boolean;
  
  /** 最小段落文字数（これより短い段落は除外） */
  minParagraphLength?: number;
}

/**
 * 段落解析結果
 */
export interface ParagraphAnalysisResult {
  /** 検出された段落一覧 */
  paragraphs: Paragraph[];
  
  /** 解析統計 */
  statistics: {
    /** 総段落数 */
    totalCount: number;
    
    /** 種類別段落数 */
    countsByType: Record<ParagraphType, number>;
    
    /** 平均文字数 */
    averageCharCount: number;
    
    /** 総文字数 */
    totalCharCount: number;
  };
}

/**
 * 段落解析エンジンクラス
 */
export class ParagraphAnalyzer {
  
  /**
   * テキストドキュメントから段落を検出・解析
   */
  static analyze(
    document: vscode.TextDocument,
    dirtyRanges?: vscode.Range[],
    options: ParagraphAnalysisOptions = {}
  ): ParagraphAnalysisResult {
    const text = document.getText();
    const paragraphs = this.detectParagraphs(text, options);
    
    // 差分解析の場合は、影響を受ける段落のみ再計算
    if (dirtyRanges && dirtyRanges.length > 0) {
      return this.performDifferentialAnalysis(paragraphs, dirtyRanges, options);
    }
    
    return this.createAnalysisResult(paragraphs);
  }

  /**
   * テキストから段落を検出
   */
  private static detectParagraphs(
    text: string, 
    options: ParagraphAnalysisOptions = {}
  ): Paragraph[] {
    const paragraphs: Paragraph[] = [];
    const lines = text.split('\n');
    let currentOffset = 0;
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const lineStart = currentOffset;
      const lineEnd = currentOffset + line.length;
      
      // 空行はスキップ
      if (MARKDOWN_PATTERNS.emptyLine.test(line)) {
        currentOffset = lineEnd + 1; // +1 for newline character
        i++;
        continue;
      }

      // ブロック要素の検出と処理
      const blockResult = this.detectBlock(lines, i, currentOffset, options);
      if (blockResult) {
        if (blockResult.paragraph) {
          paragraphs.push(blockResult.paragraph);
        }
        i = blockResult.nextLineIndex;
        currentOffset = blockResult.nextOffset;
        continue;
      }

      // 通常の段落として処理
      const paragraphResult = this.processNormalParagraph(lines, i, currentOffset, options);
      if (paragraphResult.paragraph) {
        paragraphs.push(paragraphResult.paragraph);
      }
      
      i = paragraphResult.nextLineIndex;
      currentOffset = paragraphResult.nextOffset;
    }

    return paragraphs;
  }

  /**
   * Markdownブロック要素の検出
   */
  private static detectBlock(
    lines: string[],
    startIndex: number,
    startOffset: number,
    options: ParagraphAnalysisOptions
  ): { paragraph?: Paragraph; nextLineIndex: number; nextOffset: number } | null {
    const line = lines[startIndex];

    // 見出しの検出
    const headingMatch = line.match(MARKDOWN_PATTERNS.heading);
    if (headingMatch) {
      const text = headingMatch[1];
      const paragraph = this.createParagraph(
        text,
        startOffset,
        startOffset + line.length,
        ParagraphType.Heading
      );
      return {
        paragraph,
        nextLineIndex: startIndex + 1,
        nextOffset: startOffset + line.length + 1
      };
    }

    // リスト項目の検出
    const listMatch = line.match(MARKDOWN_PATTERNS.listItem);
    if (listMatch) {
      const text = listMatch[2] || listMatch[4];
      const paragraph = this.createParagraph(
        text,
        startOffset,
        startOffset + line.length,
        ParagraphType.ListItem
      );
      return {
        paragraph,
        nextLineIndex: startIndex + 1,
        nextOffset: startOffset + line.length + 1
      };
    }

    // 引用ブロックの検出
    if (MARKDOWN_PATTERNS.quote.test(line)) {
      return this.processQuoteBlock(lines, startIndex, startOffset, options);
    }

    // コードブロックの検出
    if (line.startsWith('```')) {
      return this.processCodeBlock(lines, startIndex, startOffset, options);
    }

    // 脚注の検出
    const footnoteMatch = line.match(MARKDOWN_PATTERNS.footnote);
    if (footnoteMatch) {
      const text = footnoteMatch[2];
      const shouldInclude = options.includeFootnotes !== false;
      const result: { paragraph?: Paragraph; nextLineIndex: number; nextOffset: number } = {
        nextLineIndex: startIndex + 1,
        nextOffset: startOffset + line.length + 1
      };
      
      if (shouldInclude) {
        result.paragraph = this.createParagraph(
          text,
          startOffset,
          startOffset + line.length,
          ParagraphType.Footnote
        );
      }
      
      return result;
    }

    return null;
  }

  /**
   * 引用ブロックの処理
   */
  private static processQuoteBlock(
    lines: string[],
    startIndex: number,
    startOffset: number,
    options: ParagraphAnalysisOptions
  ): { paragraph?: Paragraph; nextLineIndex: number; nextOffset: number } {
    const quoteLines: string[] = [];
    let i = startIndex;
    let currentOffset = startOffset;

    // 連続する引用行を収集
    while (i < lines.length && MARKDOWN_PATTERNS.quote.test(lines[i])) {
      const match = lines[i].match(MARKDOWN_PATTERNS.quote);
      if (match) {
        quoteLines.push(match[1]);
      }
      currentOffset += lines[i].length + 1;
      i++;
    }

    const text = quoteLines.join(' ').trim();
    const shouldInclude = options.includeQuotes !== false;
    const result: { paragraph?: Paragraph; nextLineIndex: number; nextOffset: number } = {
      nextLineIndex: i,
      nextOffset: currentOffset
    };

    if (shouldInclude && text.length > 0) {
      result.paragraph = this.createParagraph(
        text,
        startOffset,
        currentOffset - 1,
        ParagraphType.Quote
      );
    }

    return result;
  }

  /**
   * コードブロックの処理
   */
  private static processCodeBlock(
    lines: string[],
    startIndex: number,
    startOffset: number,
    options: ParagraphAnalysisOptions
  ): { paragraph?: Paragraph; nextLineIndex: number; nextOffset: number } {
    let i = startIndex + 1; // skip opening ```
    let currentOffset = startOffset + lines[startIndex].length + 1;
    const codeLines: string[] = [];

    // 終了の```まで収集
    while (i < lines.length && !lines[i].startsWith('```')) {
      codeLines.push(lines[i]);
      currentOffset += lines[i].length + 1;
      i++;
    }

    // 終了の```をスキップ
    if (i < lines.length) {
      currentOffset += lines[i].length + 1;
      i++;
    }

    const text = codeLines.join('\n').trim();
    const shouldInclude = options.includeCodeBlocks === true;
    const result: { paragraph?: Paragraph; nextLineIndex: number; nextOffset: number } = {
      nextLineIndex: i,
      nextOffset: currentOffset
    };

    if (shouldInclude && text.length > 0) {
      result.paragraph = this.createParagraph(
        text,
        startOffset,
        currentOffset - 1,
        ParagraphType.CodeBlock
      );
    }

    return result;
  }

  /**
   * 通常段落の処理
   */
  private static processNormalParagraph(
    lines: string[],
    startIndex: number,
    startOffset: number,
    options: ParagraphAnalysisOptions
  ): { paragraph?: Paragraph; nextLineIndex: number; nextOffset: number } {
    const paragraphLines: string[] = [];
    let i = startIndex;
    let currentOffset = startOffset;

    // 連続する非空行を段落として収集
    while (i < lines.length && !MARKDOWN_PATTERNS.emptyLine.test(lines[i])) {
      // 他のブロック要素でない場合のみ追加
      if (!this.isBlockElement(lines[i])) {
        paragraphLines.push(lines[i]);
      } else {
        break;
      }
      currentOffset += lines[i].length + 1;
      i++;
    }

    const text = paragraphLines.join(' ').trim();
    const minLength = options.minParagraphLength || 0;
    const result: { paragraph?: Paragraph; nextLineIndex: number; nextOffset: number } = {
      nextLineIndex: i,
      nextOffset: currentOffset
    };

    if (text.length >= minLength) {
      result.paragraph = this.createParagraph(
        text,
        startOffset,
        currentOffset - 1,
        ParagraphType.Normal
      );
    }

    return result;
  }

  /**
   * 行がブロック要素かどうかを判定
   */
  private static isBlockElement(line: string): boolean {
    return MARKDOWN_PATTERNS.heading.test(line) ||
           MARKDOWN_PATTERNS.listItem.test(line) ||
           MARKDOWN_PATTERNS.quote.test(line) ||
           line.startsWith('```') ||
           MARKDOWN_PATTERNS.footnote.test(line) ||
           MARKDOWN_PATTERNS.horizontalRule.test(line);
  }

  /**
   * 段落オブジェクトを作成
   */
  private static createParagraph(
    text: string,
    start: number,
    end: number,
    type: ParagraphType
  ): Paragraph {
    // NFKC正規化を適用
    const normalizedText = text.normalize('NFKC');
    
    // 文字数カウント（表示文字数ベース）
    const charCount = this.countDisplayCharacters(normalizedText);
    
    // 段落IDの生成（内容ハッシュ）
    const id = this.generateParagraphId(normalizedText);
    
    // 特徴量の抽出
    const features = this.extractFeatures(normalizedText, type);

    return {
      id,
      range: { start, end },
      text: normalizedText,
      chars: charCount,
      type,
      features
    };
  }

  /**
   * 表示文字数をカウント（NFKC正規化後）
   */
  private static countDisplayCharacters(text: string): number {
    // 制御文字や結合文字を除去してカウント
    const cleanText = text.replace(/[\u0300-\u036f\u200b-\u200f\u2028-\u2029]/g, '');
    return cleanText.length;
  }

  /**
   * 段落IDを生成（SHA1ハッシュ）
   */
  private static generateParagraphId(text: string): string {
    return crypto.createHash('sha1').update(text, 'utf8').digest('hex').substring(0, 16);
  }

  /**
   * 段落の特徴量を抽出
   */
  private static extractFeatures(text: string, type: ParagraphType): Record<string, number> {
    const analysis = TextAnalyzer.analyzeCharacters(text);
    
    // 基本特徴量
    const features: Record<string, number> = {
      // 文字種割合
      hiragana_ratio: analysis.ratios.hiragana,
      katakana_ratio: analysis.ratios.katakana,
      kanji_ratio: analysis.ratios.kanji,
      alphanumeric_ratio: analysis.ratios.alphanumeric,
      
      // 常用漢字使用率
      joyo_kanji_usage: analysis.joyoKanjiUsage,
      
      // 非常用漢字数（難易度指標）
      non_joyo_kanji_count: analysis.nonJoyoKanjiCount,
      
      // 語彙密度（内容語vs機能語の推定）
      lexical_density: this.estimateLexicalDensity(analysis),
      
      // 引用密度（【】や""の使用頻度）
      citation_density: this.calculateCitationDensity(text),
      
      // ディスコースマーカー数（しかし、したがって等）
      discourse_marker_count: this.countDiscourseMarkers(text),
      
      // 段落タイプ重み
      type_weight: this.getTypeWeight(type)
    };

    return features;
  }

  /**
   * 語彙密度の推定
   */
  private static estimateLexicalDensity(analysis: any): number {
    // 漢字+カタカナの割合を内容語密度の近似とする
    return analysis.ratios.kanji + analysis.ratios.katakana * 0.8;
  }

  /**
   * 引用密度の計算
   */
  private static calculateCitationDensity(text: string): number {
    const citationPatterns = [
      /【[^】]+】/g,        // 【】形式
      /"[^"]+"/g,          // ""形式
      /『[^』]+』/g,        // 『』形式
      /「[^」]+」/g,        // 「」形式
      /\([^)]+\)/g         // ()形式
    ];
    
    let citationCount = 0;
    citationPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      citationCount += matches ? matches.length : 0;
    });
    
    return text.length > 0 ? citationCount / text.length * 1000 : 0; // 1000文字あたりの引用数
  }

  /**
   * ディスコースマーカーの数をカウント
   */
  private static countDiscourseMarkers(text: string): number {
    const markers = [
      'しかし', 'だが', 'ところが', 'けれども',
      'したがって', 'ゆえに', 'それゆえ', 'よって',
      'また', 'さらに', 'そして', 'なお',
      'つまり', 'すなわち', 'すなわち', 'いわゆる',
      '例えば', 'たとえば', 'すなわち', 'いわば'
    ];
    
    let count = 0;
    markers.forEach(marker => {
      const regex = new RegExp(marker, 'g');
      const matches = text.match(regex);
      count += matches ? matches.length : 0;
    });
    
    return count;
  }

  /**
   * 段落タイプの重みを取得
   */
  private static getTypeWeight(type: ParagraphType): number {
    const weights: Record<ParagraphType, number> = {
      [ParagraphType.Normal]: 1.0,
      [ParagraphType.Heading]: 1.2,
      [ParagraphType.ListItem]: 0.8,
      [ParagraphType.Quote]: 0.6,
      [ParagraphType.CodeBlock]: 0.3,
      [ParagraphType.Footnote]: 0.5
    };
    
    return weights[type] || 1.0;
  }

  /**
   * 差分解析の実行
   */
  private static performDifferentialAnalysis(
    paragraphs: Paragraph[],
    dirtyRanges: vscode.Range[],
    options: ParagraphAnalysisOptions
  ): ParagraphAnalysisResult {
    // 実装では、dirtyRangesに該当する段落と前後1段落を再解析
    // ここでは簡略化して全体解析結果を返す
    return this.createAnalysisResult(paragraphs);
  }

  /**
   * 解析結果の作成
   */
  private static createAnalysisResult(paragraphs: Paragraph[]): ParagraphAnalysisResult {
    const countsByType: Record<ParagraphType, number> = {
      [ParagraphType.Normal]: 0,
      [ParagraphType.Heading]: 0,
      [ParagraphType.ListItem]: 0,
      [ParagraphType.Quote]: 0,
      [ParagraphType.CodeBlock]: 0,
      [ParagraphType.Footnote]: 0
    };

    let totalCharCount = 0;

    paragraphs.forEach(paragraph => {
      countsByType[paragraph.type]++;
      totalCharCount += paragraph.chars;
    });

    const averageCharCount = paragraphs.length > 0 ? totalCharCount / paragraphs.length : 0;

    return {
      paragraphs,
      statistics: {
        totalCount: paragraphs.length,
        countsByType,
        averageCharCount,
        totalCharCount
      }
    };
  }
}