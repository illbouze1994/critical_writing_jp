import * as vscode from 'vscode';

// We'll import the analyzer after setting up VS Code mocks per test

describe('Analyzer decorations reuse to prevent duplicate char count labels', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('decoration types are created only once across multiple analyses', async () => {
    // Prepare a mock document and editor
    const content = [
      'これはテストの段落です。十分な長さを持たせてしきい値の間に収まるようにします。',
      '',
      'こちらは二つ目の段落です。こちらも同様にしきい値の間に収めます。'
    ].join('\n');

    const doc = new (vscode as any).MockTextDocument(content, 'markdown');
    const mockEditor = {
      document: doc,
      setDecorations: jest.fn(),
    } as any;

    // Make the editor visible so analyzer can find it
    (vscode.window as any).visibleTextEditors = [mockEditor];

    const { runAnalysis } = await import('../features/analyzer');

    await runAnalysis(doc as any);
    await runAnalysis(doc as any);

    const createType = (vscode.window as any).createTextEditorDecorationType as jest.Mock;
    // Expect four types created once: over, under, keyword, charCount
    expect(createType).toHaveBeenCalledTimes(4);

    // setDecorations should be called multiple times across runs
    expect(mockEditor.setDecorations).toHaveBeenCalled();
    expect(mockEditor.setDecorations.mock.calls.length).toBeGreaterThanOrEqual(8);
  });
});
