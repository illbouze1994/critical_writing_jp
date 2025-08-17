/**
 * LLM評価機能のテストスイート
 */

import { LLMEvaluator } from '../features/llm-evaluator';
import { Paragraph, ParagraphType } from '../core/types';
import * as vscode from 'vscode';

// Mock vscode
jest.mock('vscode');

describe('LLMEvaluator', () => {
  let mockContext: vscode.ExtensionContext;
  let evaluator: LLMEvaluator;

  beforeEach(() => {
    // Mock ExtensionContext
    mockContext = {
      extensionUri: { toString: () => 'file:///mock/extension' } as vscode.Uri,
      subscriptions: [],
      workspaceState: {},
      globalState: {},
      secrets: {
        get: jest.fn(),
        store: jest.fn()
      }
    } as any;

    // Mock VS Code workspace configuration
    const mockConfig = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
        const configs: Record<string, any> = {
          'llm.enabled': false,
          'llm.backend': 'wasm',
          'llm.modelPath': ''
        };
        return configs[key] ?? defaultValue;
      }),
      update: jest.fn().mockResolvedValue(undefined)
    };

    (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

    // Mock window methods
    (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue('有効にする');
    (vscode.window.showErrorMessage as jest.Mock).mockResolvedValue(undefined);

    evaluator = LLMEvaluator.getInstance(mockContext);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Reset singleton instance
    (LLMEvaluator as any).instance = null;
  });

  describe('シングルトンパターン', () => {
    test('同じインスタンスを返すこと', () => {
      const evaluator1 = LLMEvaluator.getInstance(mockContext);
      const evaluator2 = LLMEvaluator.getInstance(mockContext);
      expect(evaluator1).toBe(evaluator2);
    });
  });

  describe('LLM機能有効状態チェック', () => {
    test('デフォルトで無効であること', () => {
      expect(evaluator.isEnabled()).toBe(false);
    });

    test('設定が有効な場合、有効を返すこと', () => {
      const mockConfig = {
        get: jest.fn().mockReturnValue(true)
      };
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);
      
      expect(evaluator.isEnabled()).toBe(true);
    });
  });

  describe('ユーザー同意フロー', () => {
    test('ユーザーが同意した場合、LLM機能を有効化すること', async () => {
      const mockConfig = {
        get: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined)
      };
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);
      (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue('有効にする');

      const result = await evaluator.enableWithConsent();

      expect(result).toBe(true);
      expect(mockConfig.update).toHaveBeenCalledWith(
        'llm.enabled',
        true,
        vscode.ConfigurationTarget.Global
      );
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('LLM機能を有効化しました')
      );
    });

    test('ユーザーがキャンセルした場合、無効のままであること', async () => {
      (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue('キャンセル');

      const result = await evaluator.enableWithConsent();

      expect(result).toBe(false);
    });

    test('初期化に失敗した場合、設定を戻すこと', async () => {
      const mockConfig = {
        get: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined)
      };
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);
      (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue('有効にする');

      // 初期化を失敗させるため、モックの動作を変更
      jest.spyOn(evaluator as any, '_doInitialize').mockRejectedValue(new Error('Mock initialization error'));

      const result = await evaluator.enableWithConsent();

      expect(result).toBe(false);
      expect(mockConfig.update).toHaveBeenCalledWith(
        'llm.enabled',
        false,
        vscode.ConfigurationTarget.Global
      );
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('LLMモデルの初期化に失敗しました')
      );
    });
  });

  describe('バッチ評価', () => {
    const createMockParagraph = (id: string, text: string): Paragraph => ({
      id,
      range: { start: 0, end: text.length },
      text,
      chars: text.length,
      type: ParagraphType.Normal,
      features: {}
    });

    test('段落のバッチ評価が正常に動作すること', async () => {
      // LLMを有効化
      const mockConfig = {
        get: jest.fn().mockReturnValue(true),
        update: jest.fn()
      };
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

      const paragraphs = [
        createMockParagraph('1', 'これは最初の段落です。'),
        createMockParagraph('2', 'これは二番目の段落で、より長いテキストを含んでいます。')
      ];

      const results = await evaluator.evaluateBatch(paragraphs);

      expect(results).toHaveLength(2);
      
      results.forEach(result => {
        expect(result).toHaveProperty('paragraphId');
        expect(result).toHaveProperty('style');
        expect(result).toHaveProperty('argumentation');
        expect(result.style).toBeGreaterThanOrEqual(0.3);
        expect(result.style).toBeLessThanOrEqual(0.8);
        expect(result.argumentation).toBeGreaterThanOrEqual(0.3);
        expect(result.argumentation).toBeLessThanOrEqual(0.8);
      });
    });

    test('LLM無効時はエラーを投げること', async () => {
      const paragraphs = [createMockParagraph('1', 'テスト段落')];

      await expect(evaluator.evaluateBatch(paragraphs)).rejects.toThrow(
        'LLM機能が無効化されています'
      );
    });

    test('キャンセルシグナルが発火した場合、処理を中断すること', async () => {
      // LLMを有効化
      const mockConfig = {
        get: jest.fn().mockReturnValue(true),
        update: jest.fn()
      };
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

      const abortController = new AbortController();
      abortController.abort();

      const paragraphs = [createMockParagraph('1', 'テスト段落')];
      const results = await evaluator.evaluateBatch(paragraphs, { 
        signal: abortController.signal 
      });

      expect(results).toEqual([]);
    });

    test('空の段落配列に対しても正常に動作すること', async () => {
      // LLMを有効化
      const mockConfig = {
        get: jest.fn().mockReturnValue(true),
        update: jest.fn()
      };
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

      const results = await evaluator.evaluateBatch([]);
      expect(results).toEqual([]);
    });
  });

  describe('LLM機能無効化', () => {
    test('LLM機能を正常に無効化すること', async () => {
      const mockConfig = {
        get: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined)
      };
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

      await evaluator.disable();

      expect(mockConfig.update).toHaveBeenCalledWith(
        'llm.enabled',
        false,
        vscode.ConfigurationTarget.Global
      );
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'LLM機能を無効化しました'
      );
    });

    test('無効化時にエラーが発生した場合、エラーメッセージを表示すること', async () => {
      const mockConfig = {
        get: jest.fn(),
        update: jest.fn().mockRejectedValue(new Error('設定更新エラー'))
      };
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

      await evaluator.disable();

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        'LLM機能の無効化に失敗しました'
      );
    });
  });

  describe('リソース管理', () => {
    test('disposeが正常に動作すること', () => {
      evaluator.dispose();
      
      // 新しいインスタンスを取得できることを確認
      const newEvaluator = LLMEvaluator.getInstance(mockContext);
      expect(newEvaluator).not.toBe(evaluator);
    });
  });

  describe('モック推論', () => {
    test('入力テンソル準備が正常に動作すること', () => {
      const paragraphs = [
        createMockParagraph('1', '短い'),
        createMockParagraph('2', '非常に長い段落のテキストで、1000文字を超える可能性がある内容')
      ];

      const inputTensor = (evaluator as any).prepareInputTensor(paragraphs);

      expect(inputTensor).toHaveProperty('data');
      expect(inputTensor).toHaveProperty('dims');
      expect(inputTensor.data).toHaveLength(2);
      expect(inputTensor.dims).toEqual([2, 1]);
    });

    test('推論結果の解析が正常に動作すること', () => {
      const paragraphs = [
        createMockParagraph('1', 'テスト段落1'),
        createMockParagraph('2', 'テスト段落2')
      ];

      const mockOutputs = {
        style_output: { data: new Float32Array([0.7, 0.5]) },
        argumentation_output: { data: new Float32Array([0.6, 0.8]) }
      };

      const results = (evaluator as any).parseResults(paragraphs, mockOutputs);

      expect(results).toHaveLength(2);
      expect(results[0].paragraphId).toBe('1');
      expect(results[0].style).toBe(0.7);
      expect(results[0].argumentation).toBe(0.6);
      expect(results[1].paragraphId).toBe('2');
      expect(results[1].style).toBe(0.5);
      expect(results[1].argumentation).toBe(0.8);
    });
  });

  describe('エラーハンドリング', () => {
    test('予期しないエラーを適切にハンドリングすること', async () => {
      // コンソールエラーをモック化
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const error = new Error('予期しないエラー');
      (vscode.window.showInformationMessage as jest.Mock).mockRejectedValue(error);

      const result = await evaluator.enableWithConsent();

      expect(result).toBe(false);
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        'LLM機能の有効化中にエラーが発生しました'
      );

      consoleSpy.mockRestore();
    });
  });
});

// テストヘルパー関数
const createMockParagraph = (id: string, text: string): Paragraph => ({
  id,
  range: { start: 0, end: text.length },
  text,
  chars: text.length,
  type: ParagraphType.Normal,
  features: {}
});