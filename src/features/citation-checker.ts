import * as vscode from 'vscode';
import { Paragraph } from '../core/types';
import { normalizeText } from '../core/utils';

/**
 * 引用トークンの種類
 */
export type CitationTokenKind = 
  | 'author' | 'year' | 'title' | 'publisher' | 'journal' 
  | 'volume' | 'issue' | 'pages' | 'doi' | 'url' | 'others';

/**
 * 引用トークン
 */
export interface CitationToken {
  kind: CitationTokenKind;
  text: string;
}

/**
 * 引用スタイル検証結果
 */
export interface CitationValidation {
  ok: boolean;
  issues: string[];
}

/**
 * 引用スタイルルール
 */
export interface CitationStyleRule {
  /** ルールID */
  id: string;
  /** 対象（文中引用 or 参考文献） */
  target: 'intext' | 'reference';
  /** 検出パターン */
  detect: RegExp;
  /** 検証関数 */
  validate(tokens: CitationToken[]): CitationValidation;
  /** フォーマット関数 */
  format(tokens: CitationToken[]): string;
  /** 正規化オプション */
  normalization?: {
    asciiPolicy?: 'full' | 'half' | 'mixed';
    bracket?: '「」' | '『』' | '（）' | '( )' | '" "';
  };
  /** 重大度 */
  severity?: 'info' | 'warn' | 'error';
}

/**
 * 引用スタイルパック
 */
export interface CitationStylePack {
  /** スタイルID */
  styleId: string;
  /** 表示名 */
  displayName: string;
  /** ロケール */
  locale: 'ja' | 'en';
  /** ルール一覧 */
  rules: CitationStyleRule[];
  /** 参考文献の並び順 */
  referencesOrdering?: 'alphabetical' | 'appearance';
  /** 参考文献の区切り文字 */
  referenceDelimiter?: 'newline' | 'semicolon';
}

/**
 * 引用違反情報
 */
export interface CitationViolation {
  /** 違反箇所の範囲 */
  range: vscode.Range;
  /** 現在のテキスト */
  originalText: string;
  /** 修正後のテキスト */
  correctedText: string;
  /** エラーメッセージ */
  message: string;
  /** 重大度 */
  severity: vscode.DiagnosticSeverity;
  /** 適用されたルール */
  ruleId: string;
  /** 問題の詳細 */
  issues: string[];
}

/**
 * 引用スタイル適合検査エンジン
 */
export class CitationChecker {
  private stylePackCache = new Map<string, CitationStylePack>();
  private activeStyleId: string = 'generic.ja.v1';

  /**
   * スタイルパックを読み込み
   * @param stylePack スタイルパック
   */
  loadStylePack(stylePack: CitationStylePack): void {
    this.stylePackCache.set(stylePack.styleId, stylePack);
    console.log(`[CitationChecker] Loaded style pack: ${stylePack.styleId}`);
  }

  /**
   * スタイルパックファイルから読み込み
   * @param filePath ファイルパス
   */
  async loadStylePackFromFile(filePath: string): Promise<void> {
    try {
      const fs = require('fs').promises;
      const content = await fs.readFile(filePath, 'utf8');
      const stylePack: CitationStylePack = JSON.parse(content);
      this.loadStylePack(stylePack);
    } catch (error) {
      console.error('[CitationChecker] Failed to load style pack:', error);
      throw error;
    }
  }

  /**
   * アクティブスタイルを設定
   * @param styleId スタイルID
   */
  setActiveStyle(styleId: string): void {
    if (!this.stylePackCache.has(styleId)) {
      throw new Error(`Style pack not found: ${styleId}`);
    }
    this.activeStyleId = styleId;
  }

  /**
   * 引用スタイルの検証
   * @param document VS Codeドキュメント
   * @param paragraphs 対象段落一覧
   * @returns 引用違反の配列
   */
  validateCitationStyle(document: vscode.TextDocument, paragraphs: Paragraph[]): CitationViolation[] {
    const stylePack = this.stylePackCache.get(this.activeStyleId);
    if (!stylePack) {
      console.warn(`[CitationChecker] Active style pack not found: ${this.activeStyleId}`);
      return [];
    }

    const violations: CitationViolation[] = [];

    for (const paragraph of paragraphs) {
      const paragraphViolations = this.validateParagraph(document, paragraph, stylePack);
      violations.push(...paragraphViolations);
    }

    return violations;
  }

  /**
   * 単一段落の引用検証
   * @param document VS Codeドキュメント
   * @param paragraph 対象段落
   * @param stylePack 適用するスタイルパック
   * @returns 引用違反の配列
   */
  private validateParagraph(
    document: vscode.TextDocument, 
    paragraph: Paragraph, 
    stylePack: CitationStylePack
  ): CitationViolation[] {
    const violations: CitationViolation[] = [];
    const normalizedText = normalizeText(paragraph.text);

    // 各ルールを適用
    for (const rule of stylePack.rules) {
      const matches = normalizedText.matchAll(rule.detect);
      
      for (const match of matches) {
        if (!match.index) continue;

        // マッチしたテキストからトークンを抽出
        const tokens = this.extractTokens(match[0], rule);
        
        // 検証実行
        const validation = rule.validate(tokens);
        
        if (!validation.ok) {
          // 正しい形式を生成
          const correctedText = rule.format(tokens);
          
          // ドキュメント内の絶対位置を計算
          const startPosition = document.positionAt(paragraph.range.start + match.index);
          const endPosition = document.positionAt(paragraph.range.start + match.index + match[0].length);
          const range = new vscode.Range(startPosition, endPosition);

          // 重大度の変換
          const severity = this.convertSeverity(rule.severity || 'warn');

          // エラーメッセージの構築
          const message = `引用形式が「${rule.id}」スタイルに適合していません: ${validation.issues.join(', ')}`;

          violations.push({
            range,
            originalText: match[0],
            correctedText,
            message,
            severity,
            ruleId: rule.id,
            issues: validation.issues
          });
        }
      }
    }

    return violations;
  }

  /**
   * VS Code診断情報の生成
   * @param violations 引用違反配列
   * @returns 診断情報配列
   */
  createDiagnostics(violations: CitationViolation[]): vscode.Diagnostic[] {
    return violations.map(violation => {
      const diagnostic = new vscode.Diagnostic(
        violation.range,
        violation.message,
        violation.severity
      );
      
      diagnostic.source = 'CriticalWritingJp-Citation';
      diagnostic.code = violation.correctedText; // CodeActionで使用
      
      return diagnostic;
    });
  }

  /**
   * マッチしたテキストからトークンを抽出
   * @param matchText マッチしたテキスト
   * @param rule 適用されたルール
   * @returns トークン配列
   */
  private extractTokens(matchText: string, rule: CitationStyleRule): CitationToken[] {
    const tokens: CitationToken[] = [];
    
    if (rule.target === 'intext') {
      // 文中引用のトークン抽出
      tokens.push(...this.extractIntextTokens(matchText));
    } else {
      // 参考文献のトークン抽出
      tokens.push(...this.extractReferenceTokens(matchText));
    }

    return tokens;
  }

  /**
   * 文中引用のトークン抽出
   * @param text 引用テキスト
   * @returns トークン配列
   */
  private extractIntextTokens(text: string): CitationToken[] {
    const tokens: CitationToken[] = [];

    // (著者 年)形式
    const authorYearMatch = text.match(/^[（\(]([^）\)]+)\s+(\d{4})[^）\)]*[）\)]$/);
    if (authorYearMatch) {
      tokens.push({ kind: 'author', text: authorYearMatch[1].trim() });
      tokens.push({ kind: 'year', text: authorYearMatch[2] });
      return tokens;
    }

    // 【著者『タイトル』】形式
    const japaneseMatch = text.match(/^【([^『】]+)『([^』]+)』】$/);
    if (japaneseMatch) {
      tokens.push({ kind: 'author', text: japaneseMatch[1].trim() });
      tokens.push({ kind: 'title', text: japaneseMatch[2] });
      return tokens;
    }

    // その他の形式（簡易解析）
    tokens.push({ kind: 'others', text: text });
    return tokens;
  }

  /**
   * 参考文献のトークン抽出
   * @param text 参考文献テキスト
   * @returns トークン配列
   */
  private extractReferenceTokens(text: string): CitationToken[] {
    const tokens: CitationToken[] = [];

    // 簡易的な解析（実際にはより複雑な処理が必要）
    
    // 年の抽出
    const yearMatch = text.match(/\b(\d{4})\b/);
    if (yearMatch) {
      tokens.push({ kind: 'year', text: yearMatch[1] });
    }

    // URLの抽出
    const urlMatch = text.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      tokens.push({ kind: 'url', text: urlMatch[0] });
    }

    // DOIの抽出
    const doiMatch = text.match(/doi:\s*([^\s]+)/i);
    if (doiMatch) {
      tokens.push({ kind: 'doi', text: doiMatch[1] });
    }

    // その他の部分
    tokens.push({ kind: 'others', text: text });
    
    return tokens;
  }

  /**
   * 重大度の変換
   * @param severity 文字列重大度
   * @returns VS Codeの重大度
   */
  private convertSeverity(severity: 'info' | 'warn' | 'error'): vscode.DiagnosticSeverity {
    switch (severity) {
      case 'error': return vscode.DiagnosticSeverity.Error;
      case 'warn': return vscode.DiagnosticSeverity.Warning;
      case 'info': return vscode.DiagnosticSeverity.Information;
      default: return vscode.DiagnosticSeverity.Warning;
    }
  }

  /**
   * デフォルトスタイルパックの初期化
   */
  initializeDefaultStyles(): void {
    // 汎用日本語スタイル
    const genericJaStyle: CitationStylePack = {
      styleId: 'generic.ja.v1',
      displayName: '汎用日本語スタイル v1',
      locale: 'ja',
      rules: [
        {
          id: 'ja-intext-author-year',
          target: 'intext',
          detect: /（[^）]+\s+\d{4}[^）]*）/g,
          validate: (tokens) => {
            const authorToken = tokens.find(t => t.kind === 'author');
            const yearToken = tokens.find(t => t.kind === 'year');
            
            const issues: string[] = [];
            if (!authorToken || authorToken.text.length === 0) {
              issues.push('著者名が不明');
            }
            if (!yearToken || !/^\d{4}$/.test(yearToken.text)) {
              issues.push('年が4桁ではない');
            }
            
            return { ok: issues.length === 0, issues };
          },
          format: (tokens) => {
            const author = tokens.find(t => t.kind === 'author')?.text || '著者不明';
            const year = tokens.find(t => t.kind === 'year')?.text || '年不明';
            return `（${author} ${year}）`;
          },
          severity: 'warn'
        },
        {
          id: 'ja-intext-bracket-format',
          target: 'intext',
          detect: /【[^】]+】/g,
          validate: (tokens) => {
            // 【】形式の基本検証
            return { ok: true, issues: [] };
          },
          format: (tokens) => {
            const text = tokens.find(t => t.kind === 'others')?.text || '';
            return text;
          },
          severity: 'info'
        }
      ],
      referencesOrdering: 'appearance',
      referenceDelimiter: 'newline'
    };

    this.loadStylePack(genericJaStyle);
  }
}

/**
 * シングルトンインスタンス
 */
export const citationChecker = new CitationChecker();