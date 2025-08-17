import { StyleChecker, StyleDictionaryEntry } from '../features/style-checker';
import { Paragraph, ParagraphType } from '../core/types';
import * as vscode from 'vscode';

// VS Codeのモック
jest.mock('vscode', () => ({
  Range: jest.fn().mockImplementation((start, end) => ({ start, end })),
  Position: jest.fn().mockImplementation((line, char) => ({ line, char })),
  DiagnosticSeverity: {
    Error: 0,
    Warning: 1,
    Information: 2,
    Hint: 3
  },
  Diagnostic: jest.fn().mockImplementation((range, message, severity) => ({
    range,
    message,
    severity,
    source: '',
    code: ''
  }))
}));

const mockDocument = {
  positionAt: jest.fn((offset: number) => ({ line: 0, character: offset }))
} as any;

describe('StyleChecker', () => {
  let styleChecker: StyleChecker;
  
  beforeEach(() => {
    styleChecker = new StyleChecker();
  });

  describe('loadDictionary', () => {
    it('should load dictionary entries successfully', () => {
      const entries: StyleDictionaryEntry[] = [
        {
          pattern: 'だと思います',
          suggestion: 'と考えられます',
          severity: 'warn',
          note: 'より学術的な表現を使用してください'
        },
        {
          pattern: 'すごく',
          suggestion: '非常に',
          severity: 'info',
          category: '表現'
        }
      ];

      expect(() => {
        styleChecker.loadDictionary(entries);
      }).not.toThrow();
    });

    it('should build automaton after loading dictionary', () => {
      const entries: StyleDictionaryEntry[] = [
        {
          pattern: 'テスト用語',
          suggestion: '検証用語',
          severity: 'warn'
        }
      ];

      styleChecker.loadDictionary(entries);
      
      // 内部状態は直接テストできないが、例外が投げられないことを確認
      expect(() => {
        styleChecker.checkStyle(mockDocument, []);
      }).not.toThrow();
    });
  });

  describe('checkStyle', () => {
    beforeEach(() => {
      const entries: StyleDictionaryEntry[] = [
        {
          pattern: 'だと思います',
          suggestion: 'と考えられます',
          severity: 'warn',
          note: '学術的表現を使用'
        },
        {
          pattern: 'すごく',
          suggestion: '非常に',
          severity: 'info'
        },
        {
          pattern: '禁止用語',
          suggestion: '適切な用語',
          severity: 'error',
          note: 'この用語は使用禁止です'
        }
      ];
      
      styleChecker.loadDictionary(entries);
    });

    it('should detect style violations', () => {
      const paragraphs: Paragraph[] = [
        {
          id: 'test1',
          range: { start: 0, end: 30 },
          text: 'この結果はすごく重要だと思います。',
          chars: 20,
          type: ParagraphType.Normal
        }
      ];

      const violations = styleChecker.checkStyle(mockDocument, paragraphs);
      
      expect(violations.length).toBe(2);
      expect(violations.some(v => v.pattern === 'すごく')).toBe(true);
      expect(violations.some(v => v.pattern === 'だと思います')).toBe(true);
    });

    it('should provide correct violation details', () => {
      const paragraphs: Paragraph[] = [
        {
          id: 'test2',
          range: { start: 0, end: 20 },
          text: 'これは禁止用語です。',
          chars: 15,
          type: ParagraphType.Normal
        }
      ];

      const violations = styleChecker.checkStyle(mockDocument, paragraphs);
      
      expect(violations.length).toBe(1);
      const violation = violations[0];
      
      expect(violation.pattern).toBe('禁止用語');
      expect(violation.suggestion).toBe('適切な用語');
      expect(violation.note).toBe('この用語は使用禁止です');
      expect(violation.message).toContain('禁止用語');
      expect(violation.message).toContain('適切な用語');
    });

    it('should handle empty dictionary', () => {
      const emptyStyleChecker = new StyleChecker();
      
      const paragraphs: Paragraph[] = [
        {
          id: 'test3',
          range: { start: 0, end: 20 },
          text: 'テストテキストです。',
          chars: 15,
          type: ParagraphType.Normal
        }
      ];

      const violations = emptyStyleChecker.checkStyle(mockDocument, paragraphs);
      
      expect(violations).toEqual([]);
    });

    it('should handle empty paragraphs', () => {
      const violations = styleChecker.checkStyle(mockDocument, []);
      
      expect(violations).toEqual([]);
    });

    it('should handle paragraphs with empty text', () => {
      const paragraphs: Paragraph[] = [
        {
          id: 'empty1',
          range: { start: 0, end: 0 },
          text: '',
          chars: 0,
          type: ParagraphType.Normal
        }
      ];

      const violations = styleChecker.checkStyle(mockDocument, paragraphs);
      
      expect(violations).toEqual([]);
    });

    it('should prioritize longest matches', () => {
      const entries: StyleDictionaryEntry[] = [
        {
          pattern: 'データ',
          suggestion: 'データ情報',
          severity: 'info'
        },
        {
          pattern: 'データベース',
          suggestion: 'データベース管理システム',
          severity: 'warn'
        }
      ];
      
      const longMatchChecker = new StyleChecker();
      longMatchChecker.loadDictionary(entries);
      
      const paragraphs: Paragraph[] = [
        {
          id: 'long1',
          range: { start: 0, end: 30 },
          text: 'データベースの設計が重要です。',
          chars: 20,
          type: ParagraphType.Normal
        }
      ];

      const violations = longMatchChecker.checkStyle(mockDocument, paragraphs);
      
      // 最長マッチ優先で「データベース」が検出される（「データ」ではない）
      expect(violations.length).toBe(1);
      expect(violations[0].pattern).toBe('データベース');
    });
  });

  describe('createDiagnostics', () => {
    it('should create VS Code diagnostics from violations', () => {
      const mockRange = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 10));
      
      const violations = [
        {
          range: mockRange,
          message: 'テストメッセージ',
          severity: vscode.DiagnosticSeverity.Warning,
          pattern: 'テストパターン',
          suggestion: 'テスト提案'
        }
      ];

      const diagnostics = styleChecker.createDiagnostics(violations);
      
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].range).toBe(mockRange);
      expect(diagnostics[0].message).toBe('テストメッセージ');
      expect(diagnostics[0].severity).toBe(vscode.DiagnosticSeverity.Warning);
      expect(diagnostics[0].source).toBe('CriticalWritingJp-Style');
      expect(diagnostics[0].code).toBe('テスト提案');
    });

    it('should handle violations without suggestions', () => {
      const mockRange = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 10));
      
      const violations = [
        {
          range: mockRange,
          message: 'テストメッセージ',
          severity: vscode.DiagnosticSeverity.Error,
          pattern: 'テストパターン'
          // suggestion は undefined
        }
      ];

      const diagnostics = styleChecker.createDiagnostics(violations);
      
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBeUndefined();
    });
  });

  describe('CSV parsing', () => {
    it('should parse CSV dictionary format', async () => {
      const csvContent = `pattern,suggestion,severity,note,category
だと思います,と考えられます,warn,学術的表現,表現
すごく,非常に,info,,副詞
"カンマ,含む",置換文字列,error,テスト,特殊`;

      // FileSystem のモック（簡略化）
      const originalReadFile = require('fs').promises.readFile;
      require('fs').promises.readFile = jest.fn().mockResolvedValue(csvContent);

      await expect(styleChecker.loadDictionaryFromFile('test.csv')).resolves.not.toThrow();
      
      // 復元
      require('fs').promises.readFile = originalReadFile;
    });

    it('should parse JSON dictionary format', async () => {
      const jsonContent = JSON.stringify([
        {
          pattern: 'テスト',
          suggestion: '検証',
          severity: 'warn',
          note: 'テスト用辞書',
          category: 'テスト'
        }
      ]);

      const originalReadFile = require('fs').promises.readFile;
      require('fs').promises.readFile = jest.fn().mockResolvedValue(jsonContent);

      await expect(styleChecker.loadDictionaryFromFile('test.json')).resolves.not.toThrow();
      
      require('fs').promises.readFile = originalReadFile;
    });

    it('should handle unsupported file formats', async () => {
      const originalReadFile = require('fs').promises.readFile;
      require('fs').promises.readFile = jest.fn().mockResolvedValue('content');

      await expect(styleChecker.loadDictionaryFromFile('test.txt')).rejects.toThrow('Unsupported dictionary format');
      
      require('fs').promises.readFile = originalReadFile;
    });
  });
});