/**
 * Unit tests for keyword highlighting functionality in ui-decorations.ts
 * Tests the new keyword highlight decoration methods
 */

import * as vscode from 'vscode';
import { UIDecorations, DecorationStyle } from '../features/ui-decorations';

// Mock VSCode API
const mockTextEditorDecorationType = {
  dispose: jest.fn(),
};

const mockEditor = {
  document: {
    getText: jest.fn(),
    positionAt: jest.fn(),
  },
  setDecorations: jest.fn(),
};

// The vscode module is auto-mocked by Jest via the __mocks__ directory

// Mock Settings
jest.mock('../platform/settings', () => ({
  Settings: jest.fn(() => ({
    counting: {
      threshold: { min: 200, max: 800 }
    }
  }))
}));

describe('UIDecorations Keyword Highlighting', () => {
  let uiDecorations: UIDecorations;
  let mockContext: any;

  beforeAll(() => {
    // Manually mock the enum that's causing issues
    (vscode as any).OverviewRulerLane = {
      Center: 2,
      Full: 7,
      Left: 1,
      Right: 4,
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockContext = {
      subscriptions: [],
    };

    // Reset mock implementations
    mockEditor.document.getText.mockReturnValue('test document content with keyword1 and keyword2');
    mockEditor.document.positionAt.mockImplementation((offset: number) => ({ line: 0, character: offset }));
    mockEditor.setDecorations.mockClear();
    (vscode.window.createTextEditorDecorationType as jest.Mock).mockReturnValue(mockTextEditorDecorationType);
    
    // Create fresh instance
    uiDecorations = UIDecorations.getInstance(mockContext);
  });

  afterEach(() => {
    // Clean up singleton instance
    if (uiDecorations) {
      uiDecorations.dispose();
    }
  });

  describe('applyKeywordHighlights', () => {
    test('should apply keyword highlights for valid keywords', async () => {
      const keywords = new Map([
        ['paragraph1', [
          { text: 'keyword1' },
          { text: 'keyword2' }
        ]],
        ['paragraph2', [
          { text: 'keyword1' }
        ]]
      ]);

      const documentText = 'This is a test document with keyword1 and keyword2 repeated keyword1';
      mockEditor.document.getText.mockReturnValue(documentText);

      // Mock positionAt to return realistic positions
      mockEditor.document.positionAt.mockImplementation((offset: number) => ({
        line: 0,
        character: offset
      }));

      await uiDecorations.applyKeywordHighlights(mockEditor as any, keywords);

      // Verify setDecorations was called
      expect(mockEditor.setDecorations).toHaveBeenCalledTimes(1);
      
      // Get the decoration call arguments
      const decorationCall = mockEditor.setDecorations.mock.calls[0];
      const decorationType = decorationCall[0];
      const ranges = decorationCall[1];

      // Verify decoration type is for keywords
      expect(decorationType).toBe(mockTextEditorDecorationType);
      
      // Verify ranges were created for keyword occurrences
      expect(ranges).toBeInstanceOf(Array);
      expect(ranges.length).toBeGreaterThan(0);
    });

    test('should handle empty keywords map', async () => {
      const keywords = new Map();

      await uiDecorations.applyKeywordHighlights(mockEditor as any, keywords);

      // Should not call setDecorations for empty keywords
      expect(mockEditor.setDecorations).not.toHaveBeenCalled();
    });

    test('should handle null/undefined keywords', async () => {
      await uiDecorations.applyKeywordHighlights(mockEditor as any, null as any);
      expect(mockEditor.setDecorations).not.toHaveBeenCalled();

      await uiDecorations.applyKeywordHighlights(mockEditor as any, undefined as any);
      expect(mockEditor.setDecorations).not.toHaveBeenCalled();
    });

    test('should handle null/undefined editor', async () => {
      const keywords = new Map([['paragraph1', [{ text: 'keyword1' }]]]);

      // Should not throw when editor is null/undefined
      await expect(uiDecorations.applyKeywordHighlights(null as any, keywords)).resolves.not.toThrow();
      await expect(uiDecorations.applyKeywordHighlights(undefined as any, keywords)).resolves.not.toThrow();
    });

    test('should handle keywords with special regex characters', async () => {
      const keywords = new Map([
        ['paragraph1', [
          { text: 'keyword.*' },
          { text: 'keyword+' },
          { text: 'keyword?' },
          { text: 'keyword(test)' },
          { text: 'keyword[0-9]' }
        ]]
      ]);

      const documentText = 'This contains keyword.* and keyword+ and keyword? and keyword(test) and keyword[0-9]';
      mockEditor.document.getText.mockReturnValue(documentText);

      await uiDecorations.applyKeywordHighlights(mockEditor as any, keywords);

      // Should handle special characters by escaping them
      expect(mockEditor.setDecorations).toHaveBeenCalledTimes(1);
      
      const decorationCall = mockEditor.setDecorations.mock.calls[0];
      const ranges = decorationCall[1];
      
      // Should find exact matches for special characters
      expect(ranges.length).toBeGreaterThan(0);
    });

    test('should handle keywords with different formats', async () => {
      const keywords = new Map([
        ['paragraph1', [
          'simple-string-keyword',
          { text: 'object-keyword' },
          { text: 'another-keyword', score: 0.8 }
        ]]
      ]);

      const documentText = 'Document with simple-string-keyword and object-keyword and another-keyword';
      mockEditor.document.getText.mockReturnValue(documentText);

      await uiDecorations.applyKeywordHighlights(mockEditor as any, keywords);

      expect(mockEditor.setDecorations).toHaveBeenCalledTimes(1);
      
      const decorationCall = mockEditor.setDecorations.mock.calls[0];
      const ranges = decorationCall[1];
      
      // Should handle both string and object formats
      expect(ranges.length).toBe(3); // One for each keyword
    });

    test('should handle case-insensitive keyword matching', async () => {
      const keywords = new Map([
        ['paragraph1', [{ text: 'KeyWord' }]]
      ]);

      const documentText = 'This has keyword and KEYWORD and KeyWord variations';
      mockEditor.document.getText.mockReturnValue(documentText);

      await uiDecorations.applyKeywordHighlights(mockEditor as any, keywords);

      expect(mockEditor.setDecorations).toHaveBeenCalledTimes(1);
      
      const decorationCall = mockEditor.setDecorations.mock.calls[0];
      const ranges = decorationCall[1];
      
      // Should find all case variations
      expect(ranges.length).toBe(3);
    });
  });

  describe('clearKeywordHighlights', () => {
    test('should clear keyword highlights', async () => {
      await uiDecorations.clearKeywordHighlights(mockEditor as any);

      // Verify setDecorations was called with empty array to clear highlights
      expect(mockEditor.setDecorations).toHaveBeenCalledTimes(1);
      
      const decorationCall = mockEditor.setDecorations.mock.calls[0];
      const decorationType = decorationCall[0];
      const ranges = decorationCall[1];

      expect(decorationType).toBe(mockTextEditorDecorationType);
      expect(ranges).toEqual([]);
    });

    test('should handle null/undefined editor gracefully', async () => {
      // Should not throw when editor is null/undefined
      await expect(uiDecorations.clearKeywordHighlights(null as any)).resolves.not.toThrow();
      await expect(uiDecorations.clearKeywordHighlights(undefined as any)).resolves.not.toThrow();
    });
  });

  describe('escapeRegex functionality', () => {
    test('should properly escape regex special characters in keywords', async () => {
      const keywords = new Map([
        ['paragraph1', [
          { text: '.*+?^${}()|[]\\' } // All regex special characters
        ]]
      ]);

      // Document contains the exact literal text (not regex pattern)
      const documentText = 'This contains .*+?^${}()|[]\\ as literal text';
      mockEditor.document.getText.mockReturnValue(documentText);

      await uiDecorations.applyKeywordHighlights(mockEditor as any, keywords);

      // Should find the literal text, not treat it as regex
      expect(mockEditor.setDecorations).toHaveBeenCalledTimes(1);
      
      const decorationCall = mockEditor.setDecorations.mock.calls[0];
      const ranges = decorationCall[1];
      
      expect(ranges.length).toBe(1);
    });
  });

  describe('integration with decoration system', () => {
    test('should use correct decoration type for keywords', async () => {
      // Verify the keyword decoration type was created during initialization
      expect(vscode.window.createTextEditorDecorationType).toHaveBeenCalledWith(
        expect.objectContaining({
          backgroundColor: 'rgba(255, 255, 0, 0.3)',
          border: '1px solid rgba(255, 215, 0, 0.8)',
          borderRadius: '2px',
          overviewRulerColor: 'rgba(255, 215, 0, 0.8)',
          overviewRulerLane: vscode.OverviewRulerLane.Center
        })
      );
    });

    test('should dispose decoration types properly', () => {
      uiDecorations.dispose();

      // Verify all decoration types were disposed
      expect(mockTextEditorDecorationType.dispose).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    test('should handle document.getText() errors', async () => {
      const keywords = new Map([['paragraph1', [{ text: 'keyword1' }]]]);
      
      mockEditor.document.getText.mockImplementation(() => {
        throw new Error('Document access error');
      });

      // Should not throw even if document access fails
      await expect(uiDecorations.applyKeywordHighlights(mockEditor as any, keywords)).resolves.not.toThrow();
    });

    test('should handle positionAt() errors', async () => {
      const keywords = new Map([['paragraph1', [{ text: 'keyword1' }]]]);
      
      mockEditor.document.getText.mockReturnValue('test keyword1 content');
      mockEditor.document.positionAt.mockImplementation(() => {
        throw new Error('Position calculation error');
      });

      // Should handle position calculation errors gracefully
      await expect(uiDecorations.applyKeywordHighlights(mockEditor as any, keywords)).resolves.not.toThrow();
    });

    test('should handle setDecorations() errors', async () => {
      const keywords = new Map([['paragraph1', [{ text: 'keyword1' }]]]);
      
      mockEditor.document.getText.mockReturnValue('test keyword1 content');
      mockEditor.setDecorations.mockImplementation(() => {
        throw new Error('Decoration setting error');
      });

      // Should handle decoration setting errors gracefully
      await expect(uiDecorations.applyKeywordHighlights(mockEditor as any, keywords)).resolves.not.toThrow();
    });
  });
});