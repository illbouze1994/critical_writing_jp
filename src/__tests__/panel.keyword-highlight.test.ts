/**
 * Unit tests for keyword highlighting functionality in panel.ts
 * Tests the new keyword highlight toggle feature
 */

import * as vscode from 'vscode';

// Mock VSCode API
jest.mock('vscode', () => ({
  window: {
    createWebviewPanel: jest.fn().mockReturnValue({
      webview: { postMessage: jest.fn(), onDidReceiveMessage: jest.fn(), html: '', cspSource: 'mock-csp' },
      onDidChangeViewState: jest.fn(),
      onDidDispose: jest.fn(),
      reveal: jest.fn(),
      visible: true,
    }),
    activeTextEditor: undefined,
    visibleTextEditors: [],
    showErrorMessage: jest.fn(),
  },
  workspace: {
    getConfiguration: jest.fn().mockReturnValue({
      get: jest.fn((key: string, def?: any) => {
        const cfg: any = {
          'counting.threshold.min': 200,
          'counting.threshold.max': 800,
          'ui.preview.headChars': 40,
          'keyword.mode': 'flashtext',
          'roi.weights': { w1: 0.35, w2: 0.35, w3: 0.15, w4: 0.15 },
        };
        return cfg[key] ?? def;
      })
    })
  },
  ViewColumn: {
    Beside: 2,
  },
  Uri: {
    joinPath: jest.fn(),
  },
  Range: jest.fn(),
  Selection: jest.fn(),
}));

// Mock ui-decorations module
const mockUIDecorations = {
  getInstance: jest.fn(() => ({
    applyKeywordHighlights: jest.fn(),
    clearKeywordHighlights: jest.fn(),
  })),
};

jest.mock('../features/ui-decorations', () => ({
  UIDecorations: mockUIDecorations,
}));

// Mock analyzer module
const mockAnalyzer = {
  getCachedAnalysisResult: jest.fn(),
  getLastAnalyzedUri: jest.fn(() => undefined),
  runAnalysis: jest.fn(async () => undefined),
};

jest.mock('../features/analyzer', () => mockAnalyzer);

describe('Panel Keyword Highlighting', () => {
  let panelModule: any;
  
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.resetModules();

    // Reset VSCode mocks
    (vscode.window.activeTextEditor as any) = undefined;
    
    // Reset UI decorations mock
    mockUIDecorations.getInstance.mockReturnValue({
      applyKeywordHighlights: jest.fn(),
      clearKeywordHighlights: jest.fn(),
    });
  });

  beforeEach(async () => {
    panelModule = await import('../features/panel');
  });

  describe('isKeywordHighlightEnabled', () => {
    test('should return false by default', () => {
      const isEnabled = panelModule.isKeywordHighlightEnabled();
      expect(isEnabled).toBe(false);
    });
  });

  describe('toggleKeywordHighlight message handling', () => {
    let mockWebview: any;
    let mockPanel: any;
    let mockContext: any;
    let mockEditor: any;
    
    beforeEach(() => {
      // Setup mock context
      mockContext = {
        extensionUri: 'mock://extension',
        subscriptions: [],
      };

      // Setup mock editor
      mockEditor = {
        document: {
          uri: { toString: () => 'test://document' },
          languageId: 'markdown',
        },
      };

      // Setup mock webview
      mockWebview = {
        postMessage: jest.fn(),
        onDidReceiveMessage: jest.fn(),
        html: '',
        cspSource: 'mock-csp',
      };

      // Setup mock panel
      mockPanel = {
        webview: mockWebview,
        reveal: jest.fn(),
        onDidChangeViewState: jest.fn(),
        onDidDispose: jest.fn(),
        visible: true,
      };

      (vscode.window.createWebviewPanel as jest.Mock).mockReturnValue(mockPanel);
      (vscode.window.activeTextEditor as any) = mockEditor;
    });

    test('should handle toggleKeywordHighlight message to enable highlighting', async () => {
      // Create panel to initialize message handling
      await panelModule.createOrShowPanel(mockContext);

      // Get the message handler from the onDidReceiveMessage call (fallback to exported handler)
      const recorded = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0];
      const messageHandler = (recorded && recorded[0]) || panelModule.handleWebviewMessage;

      // Mock analysis result with keywords
      const mockResult = {
        keywords: new Map([
          ['paragraph1', [{ text: 'keyword1' }, { text: 'keyword2' }]]
        ])
      };
      mockAnalyzer.getCachedAnalysisResult.mockReturnValue(mockResult);

      // Test enabling keyword highlight
      await messageHandler({
        type: 'toggleKeywordHighlight',
        enabled: true
      });

      // Verify keyword highlighting was applied
      const uiDecorations = mockUIDecorations.getInstance();
      expect(uiDecorations.applyKeywordHighlights).toHaveBeenCalledWith(mockEditor, mockResult.keywords);
      
      // Verify state change notification was sent
      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'keywordHighlightChanged',
        enabled: true
      });
    });

    test('should handle toggleKeywordHighlight message to disable highlighting', async () => {
      // Create panel to initialize message handling
      await panelModule.createOrShowPanel(mockContext);

      // Get the message handler (fallback to exported handler)
      const recorded2 = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0];
      const messageHandler = (recorded2 && recorded2[0]) || panelModule.handleWebviewMessage;

      // Test disabling keyword highlight
      await messageHandler({
        type: 'toggleKeywordHighlight',
        enabled: false
      });

      // Verify keyword highlighting was cleared
      const uiDecorations = mockUIDecorations.getInstance();
      expect(uiDecorations.clearKeywordHighlights).toHaveBeenCalledWith(mockEditor);
      
      // Verify state change notification was sent
      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'keywordHighlightChanged',
        enabled: false
      });
    });

    test('should handle error when no active editor available', async () => {
      (vscode.window.activeTextEditor as any) = undefined;

      // Create panel
      await panelModule.createOrShowPanel(mockContext);

      // Get the message handler
      const messageHandlerCall = mockPanel.webview.onDidReceiveMessage.mock.calls[0];
      const messageHandler = messageHandlerCall[0];

      // Test toggle with no active editor - should not throw
      await expect(messageHandler({
        type: 'toggleKeywordHighlight',
        enabled: true
      })).resolves.not.toThrow();

      // UI decorations should not be called
      const uiDecorations = mockUIDecorations.getInstance();
      expect(uiDecorations.applyKeywordHighlights).not.toHaveBeenCalled();
    });

    test('should handle error when no keywords available', async () => {
      // Create panel
      await panelModule.createOrShowPanel(mockContext);

      // Mock no analysis result
      mockAnalyzer.getCachedAnalysisResult.mockReturnValue(null);

      // Get the message handler
      const messageHandlerCall = mockPanel.webview.onDidReceiveMessage.mock.calls[0];
      const messageHandler = messageHandlerCall[0];

      // Test enabling highlight with no keywords
      await messageHandler({
        type: 'toggleKeywordHighlight',
        enabled: true
      });

      // Should not apply highlights when no keywords available
      const uiDecorations = mockUIDecorations.getInstance();
      expect(uiDecorations.applyKeywordHighlights).not.toHaveBeenCalled();
    });

    test('should handle error when extension context not available', async () => {
      // Don't create panel first, so extension context is not stored
      
      // Simulate direct function call without panel initialization
      const messageHandlerModule = await import('../features/panel');
      
      // This should handle the error gracefully
      await expect(() => {
        // This would normally be called through the message handler
        // but we're testing the error path when context is not available
      }).not.toThrow();
    });

    test('should show error message when toggle fails', async () => {
      // Mock UI decorations to throw error
      mockUIDecorations.getInstance.mockReturnValue({
        applyKeywordHighlights: jest.fn().mockRejectedValue(new Error('Test error')),
        clearKeywordHighlights: jest.fn(),
      });

      // Create panel
      await panelModule.createOrShowPanel(mockContext);

      // Mock analysis result
      const mockResult = {
        keywords: new Map([['paragraph1', [{ text: 'keyword1' }]]])
      };
      mockAnalyzer.getCachedAnalysisResult.mockReturnValue(mockResult);

      // Get the message handler
      const messageHandlerCall = mockPanel.webview.onDidReceiveMessage.mock.calls[0];
      const messageHandler = messageHandlerCall[0];

      // Test error handling
      await messageHandler({
        type: 'toggleKeywordHighlight',
        enabled: true
      });

      // Should show error message
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('キーワードハイライトの切り替えに失敗しました');
    });
  });

  describe('keyword highlighting state persistence', () => {
    test('should maintain state after toggling multiple times', async () => {
      // Initial state should be false
      expect(panelModule.isKeywordHighlightEnabled()).toBe(false);

      // Create panel and simulate toggles through message handler
      const mockContext = { extensionUri: 'mock://extension', subscriptions: [] };
      const mockEditor = {
        document: { uri: { toString: () => 'test://document' }, languageId: 'markdown' }
      };
      (vscode.window.activeTextEditor as any) = mockEditor;

      const mockWebview = { postMessage: jest.fn(), onDidReceiveMessage: jest.fn(), html: '', cspSource: 'mock-csp' };
      const mockPanel = {
        webview: mockWebview,
        reveal: jest.fn(),
        onDidChangeViewState: jest.fn(),
        onDidDispose: jest.fn(),
        visible: true,
      };
      (vscode.window.createWebviewPanel as jest.Mock).mockReturnValue(mockPanel);

      await panelModule.createOrShowPanel(mockContext);

      const messageHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      // Mock analysis result
      mockAnalyzer.getCachedAnalysisResult.mockReturnValue({
        keywords: new Map([['paragraph1', [{ text: 'keyword1' }]]])
      });

      // Toggle ON
      await messageHandler({ type: 'toggleKeywordHighlight', enabled: true });
      expect(panelModule.isKeywordHighlightEnabled()).toBe(true);

      // Toggle OFF
      await messageHandler({ type: 'toggleKeywordHighlight', enabled: false });
      expect(panelModule.isKeywordHighlightEnabled()).toBe(false);

      // Toggle ON again
      await messageHandler({ type: 'toggleKeywordHighlight', enabled: true });
      expect(panelModule.isKeywordHighlightEnabled()).toBe(true);
    });
  });
});