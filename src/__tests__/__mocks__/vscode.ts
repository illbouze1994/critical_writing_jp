/**
 * VS Code API Mock for Testing
 */

export enum ViewColumn {
  One = 1,
  Two = 2,
  Three = 3
}

export enum ConfigurationTarget {
  Global = 1,
  Workspace = 2,
  WorkspaceFolder = 3
}

export enum StatusBarAlignment {
  Left = 1,
  Right = 2
}

export enum TextEditorRevealType {
  Default = 0,
  InCenter = 1,
  InCenterIfOutsideViewport = 2,
  AtTop = 3
}

export enum DecorationRangeBehavior {
  OpenOpen = 0,
  ClosedOpen = 1,
  OpenClosed = 2,
  ClosedClosed = 3
}

export const OverviewRulerLane = {
  Left: 1,
  Center: 2,
  Right: 4,
  Full: 7,
};

export class ThemeColor {
  constructor(public id: string) {}
}

export class Range {
  constructor(public start: Position, public end: Position) {}
}

export class Position {
  constructor(public line: number, public character: number) {}
}

export class Selection extends Range {
  constructor(start: Position, end: Position) {
    super(start, end);
  }
}

export class Uri {
  static file(path: string): Uri {
    return new Uri(path);
  }

  static parse(path: string): Uri {
    return new Uri(path);
  }
  
  static joinPath(base: Uri, ...pathSegments: string[]): Uri {
    return new Uri(base.path + '/' + pathSegments.join('/'));
  }
  
  constructor(private path: string) {}
  
  toString(): string {
    return this.path;
  }
}

export const workspace = {
  getConfiguration: jest.fn().mockReturnValue({
    get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
      const config: Record<string, any> = {
        'counting.threshold.min': 200,
        'counting.threshold.max': 800,
        'keyword.mode': 'rules',
        'ui.preview.headChars': 40,
        'roi.weights': { w1: 0.35, w2: 0.35, w3: 0.15, w4: 0.15 },
        'llm.enabled': false,
        'performance.maxWorkers': 2
      };
      return config[key] ?? defaultValue;
    }),
    update: jest.fn()
  }),
  openTextDocument: jest.fn().mockImplementation((uri) => {
    return Promise.resolve(new MockTextDocument(`content for ${uri.toString()}`));
  }),
};

export const window = {
  createWebviewPanel: jest.fn().mockReturnValue({
    webview: {
      html: '',
      postMessage: jest.fn(),
      onDidReceiveMessage: jest.fn(),
      cspSource: 'vscode-resource:'
    },
    onDidDispose: jest.fn(),
    reveal: jest.fn()
  }),
  createStatusBarItem: jest.fn().mockReturnValue({
    text: '',
    show: jest.fn(),
    hide: jest.fn(),
    dispose: jest.fn()
  }),
  createTextEditorDecorationType: jest.fn().mockReturnValue({
    dispose: jest.fn()
  }),
  showInformationMessage: jest.fn(),
  showErrorMessage: jest.fn(),
  showInputBox: jest.fn(),
  showTextDocument: jest.fn(),
  activeTextEditor: undefined,
  visibleTextEditors: []
};

export const commands = {
  registerCommand: jest.fn(),
  executeCommand: jest.fn()
};

export const languages = {
  createDiagnosticCollection: jest.fn().mockReturnValue({
    set: jest.fn(),
    clear: jest.fn(),
    dispose: jest.fn()
  })
};

// Mock TextDocument
export class MockTextDocument {
  constructor(
    private content: string,
    public languageId: string = 'markdown',
    public uri: Uri = Uri.file('test.md')
  ) {}
  
  getText(): string {
    return this.content;
  }
  
  positionAt(offset: number): Position {
    const lines = this.content.substring(0, offset).split('\n');
    return new Position(lines.length - 1, lines[lines.length - 1].length);
  }
  
  offsetAt(position: Position): number {
    const lines = this.content.split('\n');
    let offset = 0;
    for (let i = 0; i < position.line; i++) {
      offset += lines[i].length + 1; // +1 for \n
    }
    return offset + position.character;
  }
}

// Mock ExtensionContext
export const mockExtensionContext = {
  subscriptions: [],
  secrets: {
    store: jest.fn(),
    get: jest.fn(),
    delete: jest.fn()
  },
  extensionUri: Uri.file('extension'),
  storagePath: 'storage',
  globalState: {
    get: jest.fn(),
    update: jest.fn()
  },
  workspaceState: {
    get: jest.fn(),
    update: jest.fn()
  }
};

// Mock TextDocumentChangeEvent
export interface MockTextDocumentChangeEvent {
  document: MockTextDocument;
  contentChanges: any[];
}