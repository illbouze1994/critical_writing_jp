// Mocks must be at the top
const mockRunAnalysis = jest.fn();
const mockGetCachedAnalysisResult = jest.fn();
jest.mock('../features/analyzer', () => ({
  __esModule: true,
  runAnalysis: mockRunAnalysis,
  getCachedAnalysisResult: mockGetCachedAnalysisResult,
  getLastAnalyzedUri: jest.fn(() => 'test-uri'),
}));

const mockApplyKeywordHighlights = jest.fn();
const mockClearKeywordHighlights = jest.fn();
jest.mock('../features/ui-decorations', () => ({
  __esModule: true,
  UIDecorations: {
    getInstance: jest.fn(() => ({
      applyKeywordHighlights: mockApplyKeywordHighlights,
      clearKeywordHighlights: mockClearKeywordHighlights,
    })),
  },
}));


import * as vscode from 'vscode';

describe('Panel Keyword Highlighting', () => {
  let handleWebviewMessage: (message: any) => Promise<void>;
  let isKeywordHighlightEnabled: () => boolean;
  let mockEditor: any;

  beforeEach(() => {
    jest.resetModules(); // Important to get fresh modules with mocks
    mockRunAnalysis.mockClear();
    mockGetCachedAnalysisResult.mockClear();
    mockApplyKeywordHighlights.mockClear();
    mockClearKeywordHighlights.mockClear();
    (vscode.window.showErrorMessage as jest.Mock).mockClear();

    // Import the module under test AFTER mocks are set up
    const panelModule = require('../features/panel');
    handleWebviewMessage = panelModule.handleWebviewMessage;
    isKeywordHighlightEnabled = panelModule.isKeywordHighlightEnabled;

    mockEditor = {
      document: {
        uri: { toString: () => 'test://document' },
        languageId: 'markdown',
      },
    };
    (vscode.window.activeTextEditor as any) = mockEditor;
  });

  it('should enable highlighting and apply decorations', async () => {
    const mockResult = { keywords: new Map([['p1', [{ text: 'keyword1' }]]]) };
    mockRunAnalysis.mockResolvedValue(mockResult as any);
    mockGetCachedAnalysisResult.mockReturnValue(mockResult as any);

    await handleWebviewMessage({ type: 'toggleKeywordHighlight', enabled: true });

    expect(isKeywordHighlightEnabled()).toBe(true);
    expect(mockRunAnalysis).toHaveBeenCalledWith(mockEditor.document);
    expect(mockApplyKeywordHighlights).toHaveBeenCalledWith(mockEditor, mockResult.keywords);
  });

  it('should disable highlighting and clear decorations', async () => {
    // Enable first to set state
    await handleWebviewMessage({ type: 'toggleKeywordHighlight', enabled: true });

    // Then disable
    await handleWebviewMessage({ type: 'toggleKeywordHighlight', enabled: false });

    expect(isKeywordHighlightEnabled()).toBe(false);
    expect(mockClearKeywordHighlights).toHaveBeenCalledWith(mockEditor);
  });

  it('should not throw if no active editor is available', async () => {
    (vscode.window.activeTextEditor as any) = undefined;

    await expect(handleWebviewMessage({ type: 'toggleKeywordHighlight', enabled: true })).resolves.not.toThrow();
    expect(mockApplyKeywordHighlights).not.toHaveBeenCalled();
  });

  it('should show error message if toggle fails', async () => {
    mockRunAnalysis.mockRejectedValue(new Error('Test error'));

    await handleWebviewMessage({ type: 'toggleKeywordHighlight', enabled: true });

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('キーワードハイライトの切り替えに失敗しました');
  });

  it('should be disabled by default', () => {
    expect(isKeywordHighlightEnabled()).toBe(false);
  });
});
