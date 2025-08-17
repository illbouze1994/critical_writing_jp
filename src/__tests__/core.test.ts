/**
 * Unit tests for core utilities and types
 */

import { normalizeText, countChars, sha1, debounce } from '../core/utils';
import { ParagraphType, Paragraph, Keyword, Scores, AnalysisResult } from '../core/types';

describe('Core Utils', () => {
  
  describe('normalizeText', () => {
    test('should normalize text using NFKC', () => {
      // Test full-width to half-width normalization
      const input = '１２３ＡＢＣ';
      const result = normalizeText(input);
      expect(result).toBe('123ABC');
    });

    test('should handle empty strings', () => {
      expect(normalizeText('')).toBe('');
    });

    test('should handle null and undefined', () => {
      expect(normalizeText(null as any)).toBe('');
      expect(normalizeText(undefined as any)).toBe('');
    });

    test('should normalize mixed Japanese and Western text', () => {
      const input = 'テスト１２３test';
      const result = normalizeText(input);
      expect(result).toContain('123');
      expect(result).toContain('test');
      expect(result).toContain('テスト');
    });
  });

  describe('countChars', () => {
    test('should count normalized characters', () => {
      const text = 'Hello World';
      const count = countChars(text);
      expect(count).toBe(11); // Including space
    });

    test('should count Japanese characters correctly', () => {
      const text = 'こんにちは世界';
      const count = countChars(text);
      expect(count).toBe(7);
    });

    test('should normalize before counting', () => {
      const text = '１２３'; // Full-width numbers
      const count = countChars(text);
      expect(count).toBe(3);
    });

    test('should handle empty strings', () => {
      expect(countChars('')).toBe(0);
    });

    test('should handle newlines and spaces', () => {
      const text = 'Line 1\nLine 2';
      const count = countChars(text);
      expect(count).toBeGreaterThan(0);
    });
  });

  describe('sha1', () => {
    test('should generate consistent hash for same input', () => {
      const text = 'test string';
      const hash1 = sha1(text);
      const hash2 = sha1(text);
      expect(hash1).toBe(hash2);
    });

    test('should generate different hashes for different inputs', () => {
      const hash1 = sha1('test1');
      const hash2 = sha1('test2');
      expect(hash1).not.toBe(hash2);
    });

    test('should generate string hashes', () => {
      const hash = sha1('test');
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });

    test('should handle empty string', () => {
      const hash = sha1('');
      expect(typeof hash).toBe('string');
    });

    test('should handle Japanese text', () => {
      const hash = sha1('日本語テスト');
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });
  });

  describe('debounce', () => {
    jest.useFakeTimers();

    test('should debounce function calls', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('should pass arguments correctly', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn('arg1', 'arg2');

      jest.advanceTimersByTime(100);

      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    test('should reset timer on subsequent calls', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn();
      jest.advanceTimersByTime(50);
      
      debouncedFn(); // Reset timer
      jest.advanceTimersByTime(50);
      
      expect(mockFn).not.toHaveBeenCalled();
      
      jest.advanceTimersByTime(50);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    afterEach(() => {
      jest.clearAllTimers();
    });
  });
});

describe('Core Types', () => {
  
  describe('ParagraphType enum', () => {
    test('should have all required paragraph types', () => {
      expect(ParagraphType.Normal).toBe('normal');
      expect(ParagraphType.Heading).toBe('heading');
      expect(ParagraphType.ListItem).toBe('listItem');
      expect(ParagraphType.Quote).toBe('quote');
      expect(ParagraphType.CodeBlock).toBe('codeBlock');
      expect(ParagraphType.Footnote).toBe('footnote');
    });
  });

  describe('Paragraph interface', () => {
    test('should create valid paragraph object', () => {
      const paragraph: Paragraph = {
        id: 'test-id',
        range: { start: 0, end: 100 },
        text: 'Test paragraph text',
        chars: 19,
        type: ParagraphType.Normal,
        features: {
          keywordCount: 2,
          discourseMarkerCount: 0,
          citationCount: 0
        }
      };

      expect(paragraph.id).toBe('test-id');
      expect(paragraph.type).toBe(ParagraphType.Normal);
      expect(paragraph.chars).toBe(19);
      expect(paragraph.features?.keywordCount).toBe(2);
    });
  });

  describe('Keyword interface', () => {
    test('should create valid keyword object', () => {
      const keyword: Keyword = {
        text: '重要',
        score: 0.8,
        frequency: 3,
        partOfSpeech: '形容詞'
      };

      expect(keyword.text).toBe('重要');
      expect(keyword.score).toBe(0.8);
      expect(keyword.frequency).toBe(3);
      expect(keyword.partOfSpeech).toBe('形容詞');
    });
  });

  describe('Scores interface', () => {
    test('should create valid scores object', () => {
      const scores: Scores = {
        roi: 0.7,
        style: 0.8,
        argumentation: 0.6,
        lexicalDensity: 0.5,
        citationDensity: 0.3,
        explain: {
          'w1': 0.35,
          'w2': 0.35,
          'w3': 0.15,
          'w4': 0.15
        }
      };

      expect(scores.roi).toBe(0.7);
      expect(scores.explain?.w1).toBe(0.35);
    });
  });

  describe('AnalysisResult interface', () => {
    test('should create valid analysis result object', () => {
      const result: AnalysisResult = {
        documentUri: 'file:///test.md',
        paragraphs: [
          {
            id: 'p1',
            range: { start: 0, end: 50 },
            text: 'First paragraph',
            chars: 15,
            type: ParagraphType.Normal
          }
        ],
        keywords: new Map([
          ['p1', [{ text: 'test', score: 0.5, frequency: 1 }]]
        ]),
        scores: new Map([
          ['p1', { roi: 0.6 }]
        ]),
        timestamp: Date.now()
      };

      expect(result.documentUri).toBe('file:///test.md');
      expect(result.paragraphs).toHaveLength(1);
      expect(result.keywords.get('p1')).toHaveLength(1);
      expect(result.scores.get('p1')?.roi).toBe(0.6);
      expect(typeof result.timestamp).toBe('number');
    });
  });
});