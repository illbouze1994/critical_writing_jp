import { CitationChecker, CitationStylePack, CitationStyleRule } from '../features/citation-checker';
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

describe('CitationChecker', () => {
  let citationChecker: CitationChecker;

  beforeEach(() => {
    citationChecker = new CitationChecker();
  });

  describe('loadStylePack', () => {
    it('should load style pack successfully', () => {
      const stylePack: CitationStylePack = {
        styleId: 'test.style.v1',
        displayName: 'テストスタイル',
        locale: 'ja',
        rules: [
          {
            id: 'test-rule',
            target: 'intext',
            detect: /（[^）]+\s+\d{4}）/g,
            validate: () => ({ ok: true, issues: [] }),
            format: () => 'formatted',
            severity: 'warn'
          }
        ]
      };

      expect(() => {
        citationChecker.loadStylePack(stylePack);
      }).not.toThrow();
    });

    it('should allow setting active style', () => {
      const stylePack: CitationStylePack = {
        styleId: 'active.test',
        displayName: 'アクティブテスト',
        locale: 'ja',
        rules: []
      };

      citationChecker.loadStylePack(stylePack);
      
      expect(() => {
        citationChecker.setActiveStyle('active.test');
      }).not.toThrow();
    });

    it('should throw error for unknown style', () => {
      expect(() => {
        citationChecker.setActiveStyle('unknown.style');
      }).toThrow('Style pack not found: unknown.style');
    });
  });

  describe('validateCitationStyle', () => {
    beforeEach(() => {
      const testRule: CitationStyleRule = {
        id: 'ja-author-year',
        target: 'intext',
        detect: /（[^）]+\s+\d{4}）/g,
        validate: (tokens) => {
          const authorToken = tokens.find(t => t.kind === 'author');
          const yearToken = tokens.find(t => t.kind === 'year');
          
          const issues: string[] = [];
          if (!authorToken || authorToken.text.trim() === '') {
            issues.push('著者名が空です');
          }
          if (!yearToken || !/^\d{4}$/.test(yearToken.text)) {
            issues.push('年が4桁ではありません');
          }
          
          return { ok: issues.length === 0, issues };
        },
        format: (tokens) => {
          const author = tokens.find(t => t.kind === 'author')?.text || '著者不明';
          const year = tokens.find(t => t.kind === 'year')?.text || '年不明';
          return `（${author} ${year}）`;
        },
        severity: 'warn'
      };

      const stylePack: CitationStylePack = {
        styleId: 'test.ja',
        displayName: 'テスト日本語',
        locale: 'ja',
        rules: [testRule]
      };

      citationChecker.loadStylePack(stylePack);
      citationChecker.setActiveStyle('test.ja');
    });

    it('should validate correct citations', () => {
      const paragraphs: Paragraph[] = [
        {
          id: 'correct1',
          range: { start: 0, end: 30 },
          text: 'この研究（山田 2020）は重要である。',
          chars: 20,
          type: ParagraphType.Normal
        }
      ];

      const violations = citationChecker.validateCitationStyle(mockDocument, paragraphs);
      
      // 正しい引用なので違反はない
      expect(violations.length).toBe(0);
    });

    it('should detect citation violations', () => {
      const paragraphs: Paragraph[] = [
        {
          id: 'violation1',
          range: { start: 0, end: 30 },
          text: 'この研究（ 2020）に基づいて。',
          chars: 20,
          type: ParagraphType.Normal
        }
      ];

      const violations = citationChecker.validateCitationStyle(mockDocument, paragraphs);
      
      expect(violations.length).toBe(1);
      expect(violations[0].issues).toContain('著者名が空です');
      expect(violations[0].ruleId).toBe('ja-author-year');
    });

    it('should provide correction suggestions', () => {
      const paragraphs: Paragraph[] = [
        {
          id: 'correction1',
          range: { start: 0, end: 25 },
          text: '研究（田中20）を参照。',
          chars: 15,
          type: ParagraphType.Normal
        }
      ];

      const violations = citationChecker.validateCitationStyle(mockDocument, paragraphs);
      
      expect(violations.length).toBe(1);
      expect(violations[0].correctedText).toBe('（田中 年不明）');
      expect(violations[0].issues).toContain('年が4桁ではありません');
    });

    it('should handle paragraphs without citations', () => {
      const paragraphs: Paragraph[] = [
        {
          id: 'no-citation',
          range: { start: 0, end: 20 },
          text: '普通のテキストです。',
          chars: 15,
          type: ParagraphType.Normal
        }
      ];

      const violations = citationChecker.validateCitationStyle(mockDocument, paragraphs);
      
      expect(violations).toEqual([]);
    });

    it('should handle empty paragraphs', () => {
      const violations = citationChecker.validateCitationStyle(mockDocument, []);
      
      expect(violations).toEqual([]);
    });

    it('should warn when style pack is not found', () => {
      const emptyChecker = new CitationChecker();
      
      const paragraphs: Paragraph[] = [
        {
          id: 'test1',
          range: { start: 0, end: 10 },
          text: 'テスト',
          chars: 5,
          type: ParagraphType.Normal
        }
      ];

      const violations = emptyChecker.validateCitationStyle(mockDocument, paragraphs);
      
      expect(violations).toEqual([]);
    });
  });

  describe('createDiagnostics', () => {
    it('should create VS Code diagnostics from violations', () => {
      const mockRange = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 10));
      
      const violations = [
        {
          range: mockRange,
          originalText: '（田中20）',
          correctedText: '（田中 2020）',
          message: '引用形式が不正です',
          severity: vscode.DiagnosticSeverity.Warning,
          ruleId: 'test-rule',
          issues: ['年が短すぎます']
        }
      ];

      const diagnostics = citationChecker.createDiagnostics(violations);
      
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].range).toBe(mockRange);
      expect(diagnostics[0].message).toBe('引用形式が不正です');
      expect(diagnostics[0].severity).toBe(vscode.DiagnosticSeverity.Warning);
      expect(diagnostics[0].source).toBe('CriticalWritingJp-Citation');
      expect(diagnostics[0].code).toBe('（田中 2020）');
    });
  });

  describe('initializeDefaultStyles', () => {
    it('should initialize default Japanese style pack', () => {
      citationChecker.initializeDefaultStyles();
      
      // デフォルトスタイルが設定されることを確認
      expect(() => {
        citationChecker.setActiveStyle('generic.ja.v1');
      }).not.toThrow();
    });

    it('should work with default style rules', () => {
      citationChecker.initializeDefaultStyles();
      citationChecker.setActiveStyle('generic.ja.v1');
      
      const paragraphs: Paragraph[] = [
        {
          id: 'default-test',
          range: { start: 0, end: 30 },
          text: '（佐藤 2021）の研究によると',
          chars: 20,
          type: ParagraphType.Normal
        }
      ];

      const violations = citationChecker.validateCitationStyle(mockDocument, paragraphs);
      
      // デフォルトルールで検証される
      expect(violations.length).toBe(0);
    });

    it('should detect bracket format citations', () => {
      citationChecker.initializeDefaultStyles();
      citationChecker.setActiveStyle('generic.ja.v1');
      
      const paragraphs: Paragraph[] = [
        {
          id: 'bracket-test',
          range: { start: 0, end: 30 },
          text: '【田中『機械学習』】を参考に',
          chars: 20,
          type: ParagraphType.Normal
        }
      ];

      const violations = citationChecker.validateCitationStyle(mockDocument, paragraphs);
      
      // 【】形式も認識される
      expect(violations.length).toBe(0);
    });
  });

  describe('loadStylePackFromFile', () => {
    it('should load style pack from JSON file', async () => {
      const mockStylePack = {
        styleId: 'file.test',
        displayName: 'ファイルテスト',
        locale: 'ja',
        rules: []
      };

      // FileSystem のモック
      const originalReadFile = require('fs').promises.readFile;
      require('fs').promises.readFile = jest.fn().mockResolvedValue(JSON.stringify(mockStylePack));

      await expect(citationChecker.loadStylePackFromFile('test.json')).resolves.not.toThrow();
      
      expect(() => {
        citationChecker.setActiveStyle('file.test');
      }).not.toThrow();

      // 復元
      require('fs').promises.readFile = originalReadFile;
    });

    it('should handle file read errors', async () => {
      const originalReadFile = require('fs').promises.readFile;
      require('fs').promises.readFile = jest.fn().mockRejectedValue(new Error('File not found'));

      await expect(citationChecker.loadStylePackFromFile('nonexistent.json')).rejects.toThrow();
      
      require('fs').promises.readFile = originalReadFile;
    });

    it('should handle invalid JSON', async () => {
      const originalReadFile = require('fs').promises.readFile;
      require('fs').promises.readFile = jest.fn().mockResolvedValue('invalid json content');

      await expect(citationChecker.loadStylePackFromFile('invalid.json')).rejects.toThrow();
      
      require('fs').promises.readFile = originalReadFile;
    });
  });

  describe('token extraction', () => {
    beforeEach(() => {
      citationChecker.initializeDefaultStyles();
      citationChecker.setActiveStyle('generic.ja.v1');
    });

    it('should extract tokens from author-year format', () => {
      const paragraphs: Paragraph[] = [
        {
          id: 'author-year',
          range: { start: 0, end: 30 },
          text: '（田中太郎 2020）の手法',
          chars: 20,
          type: ParagraphType.Normal
        }
      ];

      const violations = citationChecker.validateCitationStyle(mockDocument, paragraphs);
      
      // 正しい形式なので違反なし
      expect(violations.length).toBe(0);
    });

    it('should extract tokens from Japanese bracket format', () => {
      const paragraphs: Paragraph[] = [
        {
          id: 'japanese-bracket',
          range: { start: 0, end: 40 },
          text: '【山田『データサイエンス入門』】による',
          chars: 25,
          type: ParagraphType.Normal
        }
      ];

      const violations = citationChecker.validateCitationStyle(mockDocument, paragraphs);
      
      // 【】形式も正しく処理される
      expect(violations.length).toBe(0);
    });
  });
});