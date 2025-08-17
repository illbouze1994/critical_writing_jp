/**
 * LLM評価機能の実装
 * ユーザー同意が必要なオプトイン機能として実装
 */

import * as vscode from 'vscode';
import { Paragraph } from '../core/types';
import { LLMEvaluationResult, CancelInfo } from '../core/ipc-types';
import { Settings } from '../platform/settings';

/**
 * ONNX Runtime Webのモック型定義
 * 実際の実装では onnxruntime-web から import する
 */
interface MockONNXSession {
  run(inputs: Record<string, any>): Promise<Record<string, any>>;
}

interface MockONNXRuntime {
  InferenceSession: {
    create(modelPath: string): Promise<MockONNXSession>;
  };
  env: {
    wasm: {
      wasmPaths: string;
    };
  };
}

/**
 * LLM評価エンジンクラス
 */
export class LLMEvaluator {
  private static instance: LLMEvaluator | null = null;
  private session: MockONNXSession | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor(private context: vscode.ExtensionContext) {}

  /**
   * シングルトンインスタンスを取得
   */
  static getInstance(context: vscode.ExtensionContext): LLMEvaluator {
    if (!LLMEvaluator.instance) {
      LLMEvaluator.instance = new LLMEvaluator(context);
    }
    return LLMEvaluator.instance;
  }

  /**
   * LLM機能が有効かどうかをチェック
   */
  isEnabled(): boolean {
    const settings = new Settings();
    return settings.llm.enabled;
  }

  /**
   * ユーザー同意フローを実行してLLM機能を有効化
   */
  async enableWithConsent(): Promise<boolean> {
    try {
      const result = await vscode.window.showInformationMessage(
        'LLM機能を有効にすると、文書の内容がローカルのAIモデルで解析されます。\n' +
        '解析はすべてローカル環境で実行され、外部サーバーには送信されません。\n' +
        'この機能を有効にしますか？',
        { modal: true },
        '有効にする',
        'キャンセル'
      );

      if (result === '有効にする') {
        // 設定を更新
        const config = vscode.workspace.getConfiguration('criticalWritingJp');
        await config.update('llm.enabled', true, vscode.ConfigurationTarget.Global);

        // 初期化を試行
        try {
          await this.initialize();
          vscode.window.showInformationMessage('LLM機能を有効化しました');
          return true;
        } catch (error) {
          console.error('[LLMEvaluator] Failed to initialize:', error);
          
          // 初期化失敗時は設定を戻す
          await config.update('llm.enabled', false, vscode.ConfigurationTarget.Global);
          
          vscode.window.showErrorMessage(
            'LLMモデルの初期化に失敗しました。機能を無効化します。\n' +
            'モデルファイルの設定を確認してください。'
          );
          return false;
        }
      }

      return false;
    } catch (error) {
      console.error('[LLMEvaluator] Error in consent flow:', error);
      vscode.window.showErrorMessage('LLM機能の有効化中にエラーが発生しました');
      return false;
    }
  }

  /**
   * LLMモデルの初期化
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._doInitialize();
    return this.initializationPromise;
  }

  private async _doInitialize(): Promise<void> {
    try {
      console.log('[LLMEvaluator] Initializing ONNX Runtime...');

      // 実際の実装では動的にonnxruntime-webをインポート
      // const ort = await import('onnxruntime-web');
      
      // モック実装: 実際のWASM読み込みをシミュレート
      const mockOrt: MockONNXRuntime = {
        InferenceSession: {
          create: async (modelPath: string) => {
            console.log(`[LLMEvaluator] Loading mock model from: ${modelPath}`);
            
            // 実際の初期化時間をシミュレート（50-200ms）
            await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 150));
            
            return {
              run: async (inputs: Record<string, any>) => {
                // モック推論: 0.3-0.8の範囲でランダムスコアを返す
                const batchSize = inputs.input?.length || 1;
                const styleScores = Array(batchSize).fill(0).map(() => 0.3 + Math.random() * 0.5);
                const argumentationScores = Array(batchSize).fill(0).map(() => 0.3 + Math.random() * 0.5);
                
                return {
                  style_output: { data: new Float32Array(styleScores) },
                  argumentation_output: { data: new Float32Array(argumentationScores) }
                };
              }
            };
          }
        },
        env: {
          wasm: {
            wasmPaths: ''
          }
        }
      };

      // WASMバイナリのパス設定（実際の実装）
      const wasmPath = vscode.Uri.joinPath(this.context.extensionUri, 'dist/ort/').toString();
      mockOrt.env.wasm.wasmPaths = wasmPath;

      // モデルパスの取得
      const settings = new Settings();
      const modelPath = settings.llm.modelPath || this.getDefaultModelPath();

      // セッションの作成
      this.session = await mockOrt.InferenceSession.create(modelPath);
      this.isInitialized = true;

      console.log('[LLMEvaluator] Initialization completed successfully');

    } catch (error) {
      console.error('[LLMEvaluator] Failed to initialize:', error);
      this.isInitialized = false;
      this.session = null;
      throw new Error(`LLMモデルの初期化に失敗しました: ${error}`);
    }
  }

  /**
   * デフォルトのモデルパスを取得
   */
  private getDefaultModelPath(): string {
    // 実際の実装では拡張パッケージ内のモデルファイルパスを返す
    return vscode.Uri.joinPath(this.context.extensionUri, 'models/default-model.onnx').toString();
  }

  /**
   * 段落のバッチ評価を実行
   */
  async evaluateBatch(paragraphs: Paragraph[], cancelInfo?: CancelInfo): Promise<LLMEvaluationResult[]> {
    if (!this.isEnabled()) {
      throw new Error('LLM機能が無効化されています');
    }

    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.session) {
      throw new Error('LLMセッションが初期化されていません');
    }

    try {
      console.log(`[LLMEvaluator] Evaluating ${paragraphs.length} paragraphs`);
      const startTime = Date.now();

      // キャンセルチェック
      if (cancelInfo?.signal.aborted) {
        throw new Error('評価がキャンセルされました');
      }

      // 入力データの準備（実際の実装ではトークン化が必要）
      const inputTensor = this.prepareInputTensor(paragraphs);

      // 推論実行
      const outputs = await this.session.run({ input: inputTensor });

      // キャンセルチェック
      if (cancelInfo?.signal.aborted) {
        throw new Error('評価がキャンセルされました');
      }

      // 結果の変換
      const results = this.parseResults(paragraphs, outputs);

      const elapsedMs = Date.now() - startTime;
      console.log(`[LLMEvaluator] Batch evaluation completed in ${elapsedMs}ms`);

      return results;

    } catch (error) {
      console.error('[LLMEvaluator] Batch evaluation failed:', error);
      
      // キャンセルの場合は静かに失敗
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (cancelInfo?.signal.aborted || errorMessage.includes('キャンセル')) {
        return [];
      }
      
      throw error;
    }
  }

  /**
   * 入力テンソルの準備
   */
  private prepareInputTensor(paragraphs: Paragraph[]): any {
    // 実際の実装では形態素解析やトークン化を行う
    // ここではモックとして文字列長を使用
    const lengths = paragraphs.map(p => p.text.length);
    return {
      data: new Float32Array(lengths.map(l => Math.min(l / 1000, 1.0))),
      dims: [lengths.length, 1]
    };
  }

  /**
   * 推論結果の解析
   */
  private parseResults(paragraphs: Paragraph[], outputs: Record<string, any>): LLMEvaluationResult[] {
    const styleScores = Array.from(outputs.style_output?.data || []) as number[];
    const argumentationScores = Array.from(outputs.argumentation_output?.data || []) as number[];

    return paragraphs.map((paragraph, index) => ({
      paragraphId: paragraph.id,
      style: (styleScores[index] as number) || 0.5,
      argumentation: (argumentationScores[index] as number) || 0.5,
      explain: {
        length_factor: Math.min(paragraph.text.length / 1000, 1.0),
        complexity: 0.5 + Math.random() * 0.3
      }
    }));
  }

  /**
   * LLM機能を無効化
   */
  async disable(): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration('criticalWritingJp');
      await config.update('llm.enabled', false, vscode.ConfigurationTarget.Global);

      // リソースのクリーンアップ
      this.session = null;
      this.isInitialized = false;
      this.initializationPromise = null;

      vscode.window.showInformationMessage('LLM機能を無効化しました');
      
    } catch (error) {
      console.error('[LLMEvaluator] Failed to disable:', error);
      vscode.window.showErrorMessage('LLM機能の無効化に失敗しました');
    }
  }

  /**
   * リソースのクリーンアップ
   */
  dispose(): void {
    this.session = null;
    this.isInitialized = false;
    this.initializationPromise = null;
    LLMEvaluator.instance = null;
  }
}