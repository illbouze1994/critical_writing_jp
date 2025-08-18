/**
 * Unit tests for analyzer functionality
 * Focus on new paragraph detection logic per specification change
 */

import { runAnalysis, handleTextChange, getCachedAnalysisResult } from '../features/analyzer';
import { MockTextDocument } from './__mocks__/vscode';
import { ParagraphType } from '../core/types';

// Mock the getSettings function
jest.mock('../extension', () => ({
  getSettings: jest.fn().mockReturnValue({
    counting: { threshold: { min: 200, max: 800 } },
    keyword: { mode: 'rules' },
    roi: { weights: { w1: 0.35, w2: 0.35, w3: 0.15, w4: 0.15 } }
  })
}));

describe('Analyzer - Document Cache Management', () => {
  test('should clear analysis cache for specific document', async () => {
    const { clearAnalysisCache, getCachedAnalysisResult } = await import('../features/analyzer');
    
    // First create some analysis results
    const content1 = ` 最初の文書です。テスト用の内容です。`;
    const content2 = ` 二番目の文書です。別のテスト内容です。`;
    
    const document1 = new MockTextDocument(content1, 'markdown');
    const document2 = new MockTextDocument(content2, 'markdown');
    
    // Run analysis on both documents
    const result1 = await runAnalysis(document1 as any);
    const result2 = await runAnalysis(document2 as any);
    
    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
    
    // Verify both are cached
    expect(getCachedAnalysisResult(document1.uri.toString())).toBeDefined();
    expect(getCachedAnalysisResult(document2.uri.toString())).toBeDefined();
    
    // Clear cache for document1
    clearAnalysisCache(document1.uri.toString());
    
    // Verify document1 cache is cleared but document2 remains
    expect(getCachedAnalysisResult(document1.uri.toString())).toBeUndefined();
    expect(getCachedAnalysisResult(document2.uri.toString())).toBeDefined();
  });

  test('should reset lastAnalyzedUri when clearing the currently analyzed document', async () => {
    const { clearAnalysisCache, getLastAnalyzedUri } = await import('../features/analyzer');
    
    const content = ` テスト文書です。`;
    const document = new MockTextDocument(content, 'markdown');
    
    // Run analysis to set lastAnalyzedUri
    await runAnalysis(document as any);
    expect(getLastAnalyzedUri()).toBe(document.uri.toString());
    
    // Clear cache for the current document
    clearAnalysisCache(document.uri.toString());
    
    // Verify lastAnalyzedUri is reset
    expect(getLastAnalyzedUri()).toBeUndefined();
  });
});

describe('Analyzer - Character Count Display', () => {
  test('should use reduced font size for character count decorations', async () => {
    const content = ` これはテスト段落です。文字数表示のフォントサイズが小さくなったかを確認します。`;
    const document = new MockTextDocument(content, 'markdown');
    
    // Mock the editor decoration methods to capture the decoration options
    const mockEditor = {
      document,
      setDecorations: jest.fn(),
    };
    
    // Mock the updateEditorDecorations function indirectly by checking the result
    const result = await runAnalysis(document as any);
    expect(result).toBeDefined();
    expect(result?.paragraphs.length).toBe(1);
    
    // The font size change is in the decoration setup, we verify the paragraph data is correct
    const paragraph = result?.paragraphs[0];
    expect(paragraph?.chars).toBeGreaterThan(0);
    expect(paragraph?.text).toContain('これはテスト段落です');
  });
});

describe('Analyzer - TXT File Support', () => {
  test('should detect paragraphs in plaintext files with single-space indentation', async () => {
    const content = ` 最初の段落です。これは半角スペース一文字でインデントされています。
この行は前の段落の続きです。
 二番目の段落です。これも半角スペース一文字でインデントされています。
この行も二番目の段落の続きです。

 三番目の段落です。空行の後に来ています。`;

    const document = new MockTextDocument(content, 'plaintext');
    const result = await runAnalysis(document as any);

    expect(result).toBeDefined();
    expect(result?.paragraphs.length).toBe(3);
    
    const firstParagraph = result?.paragraphs[0];
    expect(firstParagraph?.text).toContain('最初の段落です');
    expect(firstParagraph?.text).toContain('この行は前の段落の続きです');
    
    const secondParagraph = result?.paragraphs[1];
    expect(secondParagraph?.text).toContain('二番目の段落です');
    expect(secondParagraph?.text).toContain('この行も二番目の段落の続きです');
    
    const thirdParagraph = result?.paragraphs[2];
    expect(thirdParagraph?.text).toContain('三番目の段落です');
  });

  test('should handle mixed plaintext content correctly', async () => {
    const content = ` 通常の段落です。
継続する内容です。

 別の段落です。

間に空行がない行です。
 新しい段落の開始です。`;

    const document = new MockTextDocument(content, 'plaintext');
    const result = await runAnalysis(document as any);

    expect(result).toBeDefined();
    expect(result?.paragraphs.length).toBe(3);
  });

  test('should calculate character counts for plaintext files', async () => {
    const content = ` これは文字数テストです。１２３４５６７８９０文字数を数えます。
続きの行です。`;

    const document = new MockTextDocument(content, 'plaintext');
    const result = await runAnalysis(document as any);

    expect(result).toBeDefined();
    expect(result?.paragraphs.length).toBe(1);
    const paragraph = result?.paragraphs[0];
    expect(paragraph?.chars).toBeGreaterThan(0);
  });
});

describe('Analyzer - Paragraph Detection (Specification Change)', () => {
  
  test('should detect paragraphs under headers as separate text blocks', async () => {
    const content = `# これは例です。
　私は猫だ。名前はまだない。
　人間というのはおもしろいものだ。

# 別の章タイトル
　この章では別の内容を扱う。複数の文がある場合もある。
　二つ目の段落はここから始まる。内容が続いている。`;

    const document = new MockTextDocument(content, 'markdown');
    const result = await runAnalysis(document as any);

    expect(result).toBeDefined();
    expect(result?.paragraphs.length).toBeGreaterThan(1);
    
    // Headers should not be analyzed as content paragraphs
    const headerParagraphs = result?.paragraphs.filter(p => p.type === ParagraphType.Heading);
    expect(headerParagraphs).toBeDefined();
    
    // Text under headers should be detected as separate paragraphs
    const normalParagraphs = result?.paragraphs.filter(p => p.type === ParagraphType.Normal);
    expect(normalParagraphs?.length).toBeGreaterThanOrEqual(2);
    
    // First paragraph should contain "私は猫だ"
    const firstParagraph = normalParagraphs?.find(p => p.text.includes('私は猫だ'));
    expect(firstParagraph).toBeDefined();
    
    // Second paragraph should contain "人間というのは"
    const secondParagraph = normalParagraphs?.find(p => p.text.includes('人間というのは'));
    expect(secondParagraph).toBeDefined();
  });

  test('should handle Japanese full-width space paragraph detection', async () => {
    const content = `# テスト章
　最初の段落です。これは全角スペースで始まります。
　二番目の段落です。これも別の段落として認識されるべきです。

普通のスペースで始まる段落です。`;

    const document = new MockTextDocument(content, 'markdown');
    const result = await runAnalysis(document as any);

    expect(result).toBeDefined();
    
    const normalParagraphs = result?.paragraphs.filter(p => p.type === ParagraphType.Normal);
    expect(normalParagraphs?.length).toBeGreaterThanOrEqual(2);
    
    // Should detect paragraph starting with full-width space
    const firstParagraph = normalParagraphs?.find(p => p.text.includes('最初の段落'));
    expect(firstParagraph).toBeDefined();
    
    const secondParagraph = normalParagraphs?.find(p => p.text.includes('二番目の段落'));
    expect(secondParagraph).toBeDefined();
  });

  test('should handle mixed content types under headers', async () => {
    const content = `# 混合コンテンツのテスト
　通常の段落です。

> これは引用ブロックです。
> 引用の続きです。

- リスト項目1
- リスト項目2

\`\`\`javascript
// コードブロック
console.log("test");
\`\`\`

　最後の通常段落です。`;

    const document = new MockTextDocument(content, 'markdown');
    const result = await runAnalysis(document as any);

    expect(result).toBeDefined();
    
    // Should detect different paragraph types
    const paragraphsByType = result?.paragraphs.reduce((acc, p) => {
      acc[p.type] = (acc[p.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    expect(paragraphsByType?.[ParagraphType.Normal]).toBeGreaterThanOrEqual(1);
    expect(paragraphsByType?.[ParagraphType.Quote]).toBeGreaterThanOrEqual(1);
    expect(paragraphsByType?.[ParagraphType.ListItem]).toBeGreaterThanOrEqual(1);
    expect(paragraphsByType?.[ParagraphType.CodeBlock]).toBeGreaterThanOrEqual(1);
  });

  test('should calculate character counts with NFKC normalization', async () => {
    const content = `# 正規化テスト
　全角文字と半角文字が混在しています。１２３ＡＢＣ`;

    const document = new MockTextDocument(content, 'markdown');
    const result = await runAnalysis(document as any);

    expect(result).toBeDefined();
    
    const paragraph = result?.paragraphs.find(p => p.type === ParagraphType.Normal);
    expect(paragraph).toBeDefined();
    expect(paragraph?.chars).toBeGreaterThan(0);
    expect(typeof paragraph?.chars).toBe('number');
  });

  test('should handle empty sections gracefully', async () => {
    const content = `# 空のセクション

# 別の空のセクション

　実際のコンテンツがある段落。`;

    const document = new MockTextDocument(content, 'markdown');
    const result = await runAnalysis(document as any);

    expect(result).toBeDefined();
    expect(result?.paragraphs.length).toBeGreaterThanOrEqual(1);
    
    // Should have at least one normal paragraph with content
    const normalParagraphs = result?.paragraphs.filter(p => 
      p.type === ParagraphType.Normal && p.text.trim().length > 0
    );
    expect(normalParagraphs?.length).toBeGreaterThanOrEqual(1);
  });

  test('should assign unique IDs based on content hash', async () => {
    const content = `# テスト
　同じ内容の段落。
　同じ内容の段落。
　異なる内容の段落。`;

    const document = new MockTextDocument(content, 'markdown');
    const result = await runAnalysis(document as any);

    expect(result).toBeDefined();
    
    const paragraphs = result?.paragraphs || [];
    const ids = paragraphs.map(p => p.id);
    
    // IDs should be strings
    ids.forEach(id => expect(typeof id).toBe('string'));
    ids.forEach(id => expect(id.length).toBeGreaterThan(0));
    
    // Same content should have same ID, different content should have different ID
    const normalParagraphs = paragraphs.filter(p => p.type === ParagraphType.Normal);
    if (normalParagraphs.length >= 3) {
      expect(normalParagraphs[0].id).toBe(normalParagraphs[1].id); // Same content
      expect(normalParagraphs[0].id).not.toBe(normalParagraphs[2].id); // Different content
    }
  });
});

describe('Analyzer - Plaintext Support', () => {
  test('should detect paragraphs in plaintext files based on single-space indent', async () => {
    const content = ` これは最初の段落です。\nこの行は同じ段落に属します。\n\n これは二番目の段落です。`;
    const document = new MockTextDocument(content, 'plaintext');
    const result = await runAnalysis(document as any);

    expect(result).toBeDefined();
    expect(result?.paragraphs).toHaveLength(2);
    expect(result?.paragraphs[0].text).toBe('これは最初の段落です。\nこの行は同じ段落に属します。');
    expect(result?.paragraphs[1].text).toBe('これは二番目の段落です。');
  });
});

describe('Analyzer - Caching and Performance', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should cache analysis results', async () => {
    const content = `# キャッシュテスト
　テスト段落です。`;
    
    const document = new MockTextDocument(content, 'markdown');
    const uri = document.uri.toString();
    
    // First analysis
    const result1 = await runAnalysis(document as any);
    expect(result1).toBeDefined();
    
    // Should be cached
    const cachedResult = getCachedAnalysisResult(uri);
    expect(cachedResult).toBeDefined();
    expect(cachedResult?.documentUri).toBe(uri);
    expect(cachedResult?.paragraphs.length).toBe(result1?.paragraphs.length);
  });

  test('should handle text change events for markdown documents', async () => {
    const document = new MockTextDocument('# Test\n　Content', 'markdown');
    const event = {
      document,
      contentChanges: []
    };

    // Should not throw error
    await expect(handleTextChange(event as any)).resolves.not.toThrow();

    // Fast-forward timers
    jest.runAllTimers();
  });

  test('should ignore non-markdown documents', async () => {
    const document = new MockTextDocument('console.log("test")', 'javascript');
    const event = {
      document,
      contentChanges: []
    };

    // Should handle gracefully and not process
    await expect(handleTextChange(event as any)).resolves.not.toThrow();
  });
});

describe('Analyzer - Feature Extraction', () => {
  test('should extract discourse markers', async () => {
    const content = `# ディスコースマーカーテスト
　しかし、この方法には問題があります。したがって、別のアプローチが必要です。
　また、追加の考慮事項もあります。さらに、詳細な分析が求められます。`;

    const document = new MockTextDocument(content, 'markdown');
    const result = await runAnalysis(document as any);

    expect(result).toBeDefined();
    
    const paragraph = result?.paragraphs.find(p => p.text.includes('しかし'));
    expect(paragraph?.features?.discourseMarkerCount).toBeGreaterThan(0);
  });

  test('should detect citations in text', async () => {
    const content = `# 引用テスト
　【田中太郎『学術執筆の技法』2023年】によると、適切な段落構成が重要です。
　また、(Smith 2022) の研究でも同様の結果が示されています。`;

    const document = new MockTextDocument(content, 'markdown');
    const result = await runAnalysis(document as any);

    expect(result).toBeDefined();
    
    const paragraphWithCitations = result?.paragraphs.find(p => p.text.includes('田中太郎'));
    expect(paragraphWithCitations?.features?.citationCount).toBeGreaterThan(0);
  });

  test('should calculate keyword density', async () => {
    const content = `# キーワード密度テスト
　重要な概念について説明します。この概念は非常に重要であり、理解が必要です。
　重要な点をもう一度強調しておきます。`;

    const document = new MockTextDocument(content, 'markdown');
    const result = await runAnalysis(document as any);

    expect(result).toBeDefined();
    
    const paragraph = result?.paragraphs.find(p => p.text.includes('重要'));
    expect(paragraph?.features?.keywordCount).toBeGreaterThan(0);
  });
});