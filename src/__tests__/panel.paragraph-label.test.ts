import * as vscode from 'vscode';

describe('Panel includes 段落分析 label', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('webview HTML contains 段落分析 label', async () => {
    const mockPanel = {
      webview: {
        html: '',
        postMessage: jest.fn(),
        onDidReceiveMessage: jest.fn(),
        cspSource: 'vscode-resource:',
        asWebviewUri: jest.fn((uri) => uri),
      },
      onDidDispose: jest.fn(),
      onDidChangeViewState: jest.fn(),
      reveal: jest.fn(),
      visible: true,
    } as any;

    (vscode.window as any).createWebviewPanel.mockReturnValue(mockPanel);

    const { createOrShowPanel } = await import('../features/panel');

    await createOrShowPanel({ extensionUri: (vscode as any).Uri.file('ext'), subscriptions: [] } as any);

    // The label text is present in the script template used to render content
    expect(mockPanel.webview.html).toContain('段落分析');
  });
});
