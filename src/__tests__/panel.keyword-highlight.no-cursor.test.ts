/**
 * Tests keyword highlighting when no active editor is present.
 * It should fall back to the last analyzed URI and still apply highlights.
 */
import * as vscode from 'vscode';

// Mocks
const mockPanel: any = {
  webview: {
    html: '',
    postMessage: jest.fn(),
    onDidReceiveMessage: jest.fn(),
    cspSource: 'mock-csp'
  },
  onDidDispose: jest.fn(),
  onDidChangeViewState: jest.fn(),
  reveal: jest.fn(),
  visible: true,
};

// Provide a mock TextDocument and TextEditor used when opening last analyzed URI
const mockDoc: any = {
  uri: { toString: () => 'test://document' },
  languageId: 'markdown',
  getText: () => 'This is a test document with keyword1 and Keyword2.'
};
const mockEditor: any = {
  document: mockDoc,
  setDecorations: jest.fn(),
};

// Mock analyzer exports used by panel
const mockAnalyzer = {
  getCachedAnalysisResult: jest.fn(),
  getLastAnalyzedUri: jest.fn(),
  runAnalysis: jest.fn(async () => undefined),
};

jest.mock('../features/analyzer', () => mockAnalyzer);

// Mock ui-decorations used by panel
const sharedUIDeco = {
  applyKeywordHighlights: jest.fn(),
  clearKeywordHighlights: jest.fn(),
};
const mockUIDecorations = {
  getInstance: jest.fn(() => sharedUIDeco),
};

jest.mock('../features/ui-decorations', () => ({
  UIDecorations: mockUIDecorations,
}));

// Mock VS Code API minimal set for this test only
jest.mock('vscode', () => ({
  window: {
    createWebviewPanel: jest.fn(() => mockPanel),
    activeTextEditor: undefined,
    visibleTextEditors: [],
    showTextDocument: jest.fn(async () => mockEditor),
    showErrorMessage: jest.fn(),
  },
  workspace: {
    getConfiguration: jest.fn().mockReturnValue({
      get: jest.fn((key: string, def?: any) => {
        const cfg: any = {
          'counting.threshold.min': 200,
          'counting.threshold.max': 800,
          'ui.preview.headChars': 40,
        };
        return cfg[key] ?? def;
      })
    }),
    openTextDocument: jest.fn(async () => mockDoc),
  },
  Uri: {
    file: (p: string) => ({ toString: () => p }),
    parse: (p: string) => ({ toString: () => p }),
    joinPath: jest.fn(),
  },
  ViewColumn: { Beside: 2 },
  Range: jest.fn(),
  Selection: jest.fn(),
}));

describe('Keyword highlight without active editor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockPanel.webview.postMessage as jest.Mock).mockResolvedValue(undefined);
  });

  test('applies highlights using last analyzed URI when no active editor', async () => {
    // Setup analyzer mocks
    mockAnalyzer.getLastAnalyzedUri.mockReturnValue('test://document');
    const keywords = new Map<string, any[]>([
      ['p1', [{ text: 'keyword1' }, { text: 'keyword2' }]]
    ]);
    mockAnalyzer.getCachedAnalysisResult.mockReturnValue({ keywords });

    const panel = await import('../features/panel');

    // Create panel (stores context and sets html)
    await panel.createOrShowPanel({ extensionUri: 'mock://extension', subscriptions: [] } as any);

    // Grab message handler
    const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

    // Toggle ON
    await handler({ type: 'toggleKeywordHighlight', enabled: true });

    // Verify editor resolution through lastAnalyzedUri and that highlights applied
    const uiDeco = mockUIDecorations.getInstance();
    expect(uiDeco.applyKeywordHighlights).toHaveBeenCalledWith(mockEditor, keywords);
  });
});
