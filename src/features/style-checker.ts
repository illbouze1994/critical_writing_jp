import * as vscode from 'vscode';
import { Paragraph } from '../core/types';
import { normalizeText } from '../core/utils';

/**
 * スタイル辞書エントリ
 */
export interface StyleDictionaryEntry {
  /** 検出パターン（文字列または正規表現） */
  pattern: string;
  /** 推奨表現 */
  suggestion: string;
  /** 重大度 */
  severity: 'info' | 'warn' | 'error';
  /** 補足説明 */
  note?: string;
  /** カテゴリ */
  category?: string;
}

/**
 * スタイル違反情報
 */
export interface StyleViolation {
  /** 違反箇所の範囲 */
  range: vscode.Range;
  /** エラーメッセージ */
  message: string;
  /** 重大度 */
  severity: vscode.DiagnosticSeverity;
  /** 推奨修正内容 */
  suggestion?: string;
  /** 違反パターン */
  pattern: string;
  /** 補足説明 */
  note?: string;
}

/**
 * Aho-Corasick自動機のノード
 */
class TrieNode {
  children = new Map<string, TrieNode>();
  isEndOfWord = false;
  entries: StyleDictionaryEntry[] = [];
  failure?: TrieNode;
}

/**
 * スタイルルールチェッカー
 * Aho-Corasick法を使用して辞書内の全パターンを効率的に検索
 */
export class StyleChecker {
  private root: TrieNode;
  private dictionary: StyleDictionaryEntry[] = [];
  private isBuilt = false;

  constructor() {
    this.root = new TrieNode();
  }

  /**
   * スタイル辞書を読み込み
   * @param entries 辞書エントリの配列
   */
  loadDictionary(entries: StyleDictionaryEntry[]): void {
    this.dictionary = entries;
    this.buildAutomaton();
    this.isBuilt = true;
    console.log(`[StyleChecker] Loaded ${entries.length} dictionary entries`);
  }

  /**
   * 辞書ファイルから読み込み
   * @param filePath 辞書ファイルのパス
   */
  async loadDictionaryFromFile(filePath: string): Promise<void> {
    try {
      const fs = require('fs').promises;
      const content = await fs.readFile(filePath, 'utf8');
      
      // JSON形式またはCSV形式の辞書に対応
      let entries: StyleDictionaryEntry[];
      
      if (filePath.endsWith('.json')) {
        entries = JSON.parse(content);
      } else if (filePath.endsWith('.csv')) {
        entries = this.parseCSV(content);
      } else {
        throw new Error(`Unsupported dictionary format: ${filePath}`);
      }
      
      this.loadDictionary(entries);
    } catch (error) {
      console.error('[StyleChecker] Failed to load dictionary:', error);
      throw error;
    }
  }

  /**
   * 段落のスタイルチェック
   * @param document VS Codeドキュメント
   * @param paragraphs 対象段落一覧
   * @returns スタイル違反の配列
   */
  checkStyle(document: vscode.TextDocument, paragraphs: Paragraph[]): StyleViolation[] {
    if (!this.isBuilt || this.dictionary.length === 0) {
      return [];
    }

    const violations: StyleViolation[] = [];

    for (const paragraph of paragraphs) {
      const paragraphViolations = this.checkParagraphStyle(document, paragraph);
      violations.push(...paragraphViolations);
    }

    return violations;
  }

  /**
   * 単一段落のスタイルチェック
   * @param document VS Codeドキュメント
   * @param paragraph 対象段落
   * @returns スタイル違反の配列
   */
  private checkParagraphStyle(document: vscode.TextDocument, paragraph: Paragraph): StyleViolation[] {
    const violations: StyleViolation[] = [];
    const normalizedText = normalizeText(paragraph.text);
    
    // Aho-Corasickアルゴリズムでパターンマッチング
    const matches = this.findMatches(normalizedText);
    
    for (const match of matches) {
      // ドキュメント内の絶対位置を計算
      const startPosition = document.positionAt(paragraph.range.start + match.start);
      const endPosition = document.positionAt(paragraph.range.start + match.end);
      const range = new vscode.Range(startPosition, endPosition);

      // 重大度の変換
      const severity = this.convertSeverity(match.entry.severity);

      // エラーメッセージの構築
      let message = match.entry.suggestion 
        ? `「${match.text}」は推奨されません。「${match.entry.suggestion}」を使用してください。`
        : `「${match.text}」は使用を避けてください。`;
        
      if (match.entry.note) {
        message += ` (${match.entry.note})`;
      }

      const violation: StyleViolation = {
        range,
        message,
        severity,
        suggestion: match.entry.suggestion,
        pattern: match.entry.pattern
      };
      
      if (match.entry.note !== undefined) {
        violation.note = match.entry.note;
      }
      
      violations.push(violation);
    }

    return violations;
  }

  /**
   * VS Code診断情報の生成
   * @param violations スタイル違反配列
   * @returns 診断情報配列
   */
  createDiagnostics(violations: StyleViolation[]): vscode.Diagnostic[] {
    return violations.map(violation => {
      const diagnostic = new vscode.Diagnostic(
        violation.range,
        violation.message,
        violation.severity
      );
      
      diagnostic.source = 'CriticalWritingJp-Style';
      if (violation.suggestion !== undefined) {
        diagnostic.code = violation.suggestion; // CodeActionで使用
      }
      
      return diagnostic;
    });
  }

  /**
   * Aho-Corasick自動機を構築
   */
  private buildAutomaton(): void {
    // Trie構造の構築
    for (const entry of this.dictionary) {
      this.insertPattern(entry);
    }

    // 失敗関数の構築
    this.buildFailureFunction();
  }

  /**
   * パターンをTrieに挿入
   * @param entry 辞書エントリ
   */
  private insertPattern(entry: StyleDictionaryEntry): void {
    let node = this.root;
    const pattern = normalizeText(entry.pattern);

    for (const char of pattern) {
      if (!node.children.has(char)) {
        node.children.set(char, new TrieNode());
      }
      node = node.children.get(char)!;
    }

    node.isEndOfWord = true;
    node.entries.push(entry);
  }

  /**
   * 失敗関数の構築（Aho-Corasickアルゴリズム）
   */
  private buildFailureFunction(): void {
    const queue: TrieNode[] = [];
    
    // 第1階層の失敗リンクはrootに設定
    for (const [char, child] of this.root.children) {
      child.failure = this.root;
      queue.push(child);
    }

    // BFSで失敗リンクを設定
    while (queue.length > 0) {
      const current = queue.shift()!;
      
      for (const [char, child] of current.children) {
        queue.push(child);
        
        let failure = current.failure;
        while (failure && !failure.children.has(char)) {
          failure = failure.failure;
        }
        
        child.failure = failure ? failure.children.get(char)! : this.root;
        
        // 出力リンクの設定（重複マッチの処理）
        if (child.failure.isEndOfWord) {
          child.entries.push(...child.failure.entries);
        }
      }
    }
  }

  /**
   * Aho-Corasickアルゴリズムでマッチング実行
   * @param text 検索対象テキスト
   * @returns マッチ結果の配列
   */
  private findMatches(text: string): Array<{
    start: number;
    end: number;
    text: string;
    entry: StyleDictionaryEntry;
  }> {
    const matches: Array<{
      start: number;
      end: number;
      text: string;
      entry: StyleDictionaryEntry;
    }> = [];

    let current = this.root;
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      // 遷移の実行
      while (current && !current.children.has(char)) {
        current = current.failure || this.root;
      }
      
      if (current && current.children.has(char)) {
        current = current.children.get(char)!;
      } else {
        current = this.root;
        continue;
      }
      
      // マッチした場合の処理
      if (current.isEndOfWord) {
        for (const entry of current.entries) {
          const patternLength = normalizeText(entry.pattern).length;
          const matchStart = i - patternLength + 1;
          const matchEnd = i + 1;
          const matchText = text.substring(matchStart, matchEnd);
          
          // 最長マッチ優先（重複回避）
          const isOverlapping = matches.some(existing => 
            matchStart < existing.end && matchEnd > existing.start
          );
          
          if (!isOverlapping) {
            matches.push({
              start: matchStart,
              end: matchEnd,
              text: matchText,
              entry
            });
          }
        }
      }
    }

    return matches;
  }

  /**
   * CSV辞書の解析
   * @param content CSV内容
   * @returns 辞書エントリ配列
   */
  private parseCSV(content: string): StyleDictionaryEntry[] {
    const lines = content.split('\n');
    const entries: StyleDictionaryEntry[] = [];
    
    // ヘッダー行をスキップ
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const columns = this.parseCSVLine(line);
      if (columns.length >= 3) {
        const entry: StyleDictionaryEntry = {
          pattern: columns[0],
          suggestion: columns[1],
          severity: (columns[2] as 'info' | 'warn' | 'error') || 'warn'
        };
        
        if (columns[3] && columns[3].trim()) {
          entry.note = columns[3];
        }
        
        if (columns[4] && columns[4].trim()) {
          entry.category = columns[4];
        }
        
        entries.push(entry);
      }
    }
    
    return entries;
  }

  /**
   * CSV行の解析（簡易版）
   * @param line CSV行
   * @returns カラム配列
   */
  private parseCSVLine(line: string): string[] {
    const columns: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"' && (i === 0 || line[i - 1] !== '\\')) {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        columns.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    columns.push(current.trim());
    return columns;
  }

  /**
   * 重大度の変換
   * @param severity 辞書の重大度
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
}

/**
 * シングルトンインスタンス
 */
export const styleChecker = new StyleChecker();