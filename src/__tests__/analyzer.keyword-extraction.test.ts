/**
 * Unit tests for conditional keyword extraction functionality in analyzer.ts
 * Tests that keyword extraction is disabled by default and only runs when toggle is enabled
 */

import * as vscode from 'vscode';

// Mock VSCode API
const mockWorkspaceConfig = {
  get: jest.fn(),
};

const mockDocument = {
  getText: jest.fn(),
  languageId: 'markdown',
  uri: { toString: () => 'test://document.md' },
  lineCount: 10,
  lineAt: jest.fn(),
};

jest.mock('vscode', () => ({
  workspace: {
    getConfiguration: jest.fn(() => mockWorkspaceConfig),
  },
  window: {
    activeTextEditor: undefined,
  },
}));

// Mock panel module to control keyword highlight state
const mockPanel = {
  isKeywordHighlightEnabled: jest.fn(),
};

jest.mock('../features/panel', () => mockPanel);

// Mock keyword engine
const mockKeywordEngine = {
  extractKeywords: jest.fn(),
};

// Mock ROI engine
const mockRoiEngine = {
  calculateROI: jest.fn(),
};

// Mock style checker
const mockStyleChecker = {
  checkStyle: jest.fn(),
};

// Mock citation checker
const mockCitationChecker = {
  validateCitationStyle: jest.fn(),
};

// Mock other analyzer dependencies
jest.mock('../core/keyword-extractor', () => ({
  KeywordExtractor: jest.fn(() => mockKeywordEngine),
}));

jest.mock('../core/roi-calculator', () => ({
  ROICalculator: jest.fn(() => mockRoiEngine),
}));

jest.mock('../core/style-checker', () => ({
  StyleChecker: jest.fn(() => mockStyleChecker),
}));

jest.mock('../core/citation-checker', () => ({
  CitationChecker: jest.fn(() => mockCitationChecker),
}));

// Mock UI decorations
jest.mock('../features/ui-decorations', () => ({
  UIDecorations: {
    getInstance: jest.fn(() => ({
      updateDecorations: jest.fn(),
    })),
  },
}));

describe('Analyzer Conditional Keyword Extraction', () => {
  let analyzerModule: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    
    // Setup default mock returns
    mockWorkspaceConfig.get.mockImplementation((key: string, defaultValue?: any) => {
      switch (key) {
        case 'keyword.mode':
          return 'rules';
        case 'roi.weights':
          return { w1: 0.35, w2: 0.35, w3: 0.15, w4: 0.15 };
        default:
          return defaultValue;
      }
    });

    // Setup document mock
    mockDocument.getText.mockReturnValue('Test paragraph content for analysis.');
    mockDocument.lineAt.mockImplementation((line: number) => ({
      text: line === 0 ? 'Test paragraph content for analysis.' : '',
      range: { start: { line, character: 0 }, end: { line, character: 50 } },
    }));

    // Setup engine mocks
    mockKeywordEngine.extractKeywords.mockResolvedValue(new Map([
      ['paragraph1', [{ text: 'test', score: 0.8 }, { text: 'analysis', score: 0.6 }]]
    ]));
    
    mockRoiEngine.calculateROI.mockReturnValue(new Map([
      ['paragraph1', 0.75]
    ]));
    
    mockStyleChecker.checkStyle.mockReturnValue([]);
    mockCitationChecker.validateCitationStyle.mockReturnValue([]);
  });

  beforeAll(async () => {
    analyzerModule = await import('../features/analyzer');
  });

  describe('performAnalysis with keyword toggle OFF', () => {
    test('should not extract keywords when toggle is disabled', async () => {
      // Set keyword highlight toggle to OFF
      mockPanel.isKeywordHighlightEnabled.mockReturnValue(false);

      const result = await analyzerModule.runAnalysis(mockDocument as any);

      // Verify keyword extraction was not called
      expect(mockKeywordEngine.extractKeywords).not.toHaveBeenCalled();
      
      // Verify result has empty keywords map
      expect(result?.keywords).toEqual(new Map());
      
      // Verify ROI calculation was still called (but with empty keywords)
      expect(mockRoiEngine.calculateROI).toHaveBeenCalledWith(
        expect.any(Array), // paragraphs
        new Map(), // empty keywords
        expect.any(Object) // weights
      );
    });

    test('should log that keyword extraction is disabled', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      mockPanel.isKeywordHighlightEnabled.mockReturnValue(false);

      await analyzerModule.runAnalysis(mockDocument as any);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Keyword extraction disabled - toggle is OFF')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('performAnalysis with keyword toggle ON', () => {
    test('should extract keywords when toggle is enabled', async () => {
      // Set keyword highlight toggle to ON
      mockPanel.isKeywordHighlightEnabled.mockReturnValue(true);

      const result = await analyzerModule.runAnalysis(mockDocument as any);

      // Verify keyword extraction was called
      expect(mockKeywordEngine.extractKeywords).toHaveBeenCalledTimes(1);
      expect(mockKeywordEngine.extractKeywords).toHaveBeenCalledWith(
        expect.any(Array), // paragraphs
        'rules' // keyword mode from config
      );
      
      // Verify result has extracted keywords
      expect(result?.keywords).toBeInstanceOf(Map);
      expect(result?.keywords.size).toBeGreaterThan(0);
      
      // Verify ROI calculation was called with extracted keywords
      expect(mockRoiEngine.calculateROI).toHaveBeenCalledWith(
        expect.any(Array), // paragraphs
        expect.any(Map), // extracted keywords
        expect.any(Object) // weights
      );
    });

    test('should log keyword extraction with mode', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      mockPanel.isKeywordHighlightEnabled.mockReturnValue(true);

      await analyzerModule.runAnalysis(mockDocument as any);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Extracting keywords (mode: rules)')
      );
      
      consoleSpy.mockRestore();
    });

    test('should use correct keyword extraction mode from configuration', async () => {
      // Test different keyword modes
      const modes = ['rules', 'tfidf', 'embed'];
      
      for (const mode of modes) {
        jest.clearAllMocks();
        mockWorkspaceConfig.get.mockImplementation((key: string, defaultValue?: any) => {
          if (key === 'keyword.mode') return mode;
          if (key === 'roi.weights') return { w1: 0.35, w2: 0.35, w3: 0.15, w4: 0.15 };
          return defaultValue;
        });
        
        mockPanel.isKeywordHighlightEnabled.mockReturnValue(true);

        await analyzerModule.runAnalysis(mockDocument as any);

        expect(mockKeywordEngine.extractKeywords).toHaveBeenCalledWith(
          expect.any(Array),
          mode
        );
      }
    });
  });

  describe('keyword toggle state changes during analysis', () => {
    test('should handle toggle state change between calls', async () => {
      // First call with toggle OFF
      mockPanel.isKeywordHighlightEnabled.mockReturnValue(false);
      const result1 = await analyzerModule.runAnalysis(mockDocument as any);
      
      expect(result1?.keywords).toEqual(new Map());
      expect(mockKeywordEngine.extractKeywords).not.toHaveBeenCalled();
      
      // Second call with toggle ON
      jest.clearAllMocks();
      mockKeywordEngine.extractKeywords.mockResolvedValue(new Map([
        ['paragraph1', [{ text: 'keyword', score: 0.9 }]]
      ]));
      mockPanel.isKeywordHighlightEnabled.mockReturnValue(true);
      
      const result2 = await analyzerModule.runAnalysis(mockDocument as any);
      
      expect(result2?.keywords.size).toBeGreaterThan(0);
      expect(mockKeywordEngine.extractKeywords).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling in conditional keyword extraction', () => {
    test('should handle panel import errors gracefully', async () => {
      // Mock panel import to fail
      jest.doMock('../features/panel', () => {
        throw new Error('Panel import failed');
      });

      // Should not throw even if panel import fails
      await expect(analyzerModule.runAnalysis(mockDocument as any)).resolves.toBeDefined();
    });

    test('should handle isKeywordHighlightEnabled function errors', async () => {
      // Mock function to throw error
      mockPanel.isKeywordHighlightEnabled.mockImplementation(() => {
        throw new Error('Function call failed');
      });

      // Should not throw and should default to safe behavior (no keyword extraction)
      const result = await analyzerModule.runAnalysis(mockDocument as any);
      
      expect(result).toBeDefined();
      expect(mockKeywordEngine.extractKeywords).not.toHaveBeenCalled();
    });

    test('should handle keyword extraction errors when toggle is ON', async () => {
      mockPanel.isKeywordHighlightEnabled.mockReturnValue(true);
      mockKeywordEngine.extractKeywords.mockRejectedValue(new Error('Extraction failed'));

      // Should handle keyword extraction errors gracefully
      await expect(analyzerModule.runAnalysis(mockDocument as any)).rejects.toThrow();
    });
  });

  describe('integration with other analysis components', () => {
    test('should continue with other analysis steps when keywords are disabled', async () => {
      mockPanel.isKeywordHighlightEnabled.mockReturnValue(false);

      const result = await analyzerModule.runAnalysis(mockDocument as any);

      // Verify other analysis steps still run
      expect(mockRoiEngine.calculateROI).toHaveBeenCalled();
      expect(mockStyleChecker.checkStyle).toHaveBeenCalled();
      expect(mockCitationChecker.validateCitationStyle).toHaveBeenCalled();
      
      // Verify result structure is complete
      expect(result).toBeDefined();
      expect(result?.paragraphs).toBeDefined();
      expect(result?.keywords).toEqual(new Map());
      expect(result?.scores).toBeDefined();
      expect(result?.timestamp).toBeDefined();
    });

    test('should continue with other analysis steps when keywords are enabled', async () => {
      mockPanel.isKeywordHighlightEnabled.mockReturnValue(true);

      const result = await analyzerModule.runAnalysis(mockDocument as any);

      // Verify all analysis steps run
      expect(mockKeywordEngine.extractKeywords).toHaveBeenCalled();
      expect(mockRoiEngine.calculateROI).toHaveBeenCalled();
      expect(mockStyleChecker.checkStyle).toHaveBeenCalled();
      expect(mockCitationChecker.validateCitationStyle).toHaveBeenCalled();
      
      // Verify result structure is complete with keywords
      expect(result).toBeDefined();
      expect(result?.paragraphs).toBeDefined();
      expect(result?.keywords).toBeInstanceOf(Map);
      expect(result?.keywords.size).toBeGreaterThan(0);
      expect(result?.scores).toBeDefined();
      expect(result?.timestamp).toBeDefined();
    });
  });

  describe('performance considerations', () => {
    test('should be faster when keyword extraction is disabled', async () => {
      // Mock keyword extraction to be slow
      mockKeywordEngine.extractKeywords.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(new Map()), 100))
      );

      // Test with toggle OFF (should be fast)
      mockPanel.isKeywordHighlightEnabled.mockReturnValue(false);
      const startTime1 = Date.now();
      await analyzerModule.runAnalysis(mockDocument as any);
      const duration1 = Date.now() - startTime1;

      // Test with toggle ON (should be slower)
      jest.clearAllMocks();
      mockPanel.isKeywordHighlightEnabled.mockReturnValue(true);
      const startTime2 = Date.now();
      await analyzerModule.runAnalysis(mockDocument as any);
      const duration2 = Date.now() - startTime2;

      // When disabled, should skip keyword extraction and be faster
      expect(duration1).toBeLessThan(duration2);
      expect(mockKeywordEngine.extractKeywords).toHaveBeenCalledTimes(1); // Only in second test
    });
  });
});