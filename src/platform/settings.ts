import * as vscode from 'vscode';

/**
 * 拡張機能の設定を管理するクラス
 * VS Codeの設定APIを型安全にラップする
 */
export class Settings {
  private readonly _config: vscode.WorkspaceConfiguration;

  constructor() {
    this._config = vscode.workspace.getConfiguration('criticalWritingJp');
  }

  /**
   * 文字数カウント関連設定
   */
  get counting() {
    return {
      threshold: {
        min: this._config.get<number>('counting.threshold.min', 200),
        max: this._config.get<number>('counting.threshold.max', 800)
      }
    };
  }

  /**
   * キーワード抽出関連設定
   */
  get keyword() {
    return {
      mode: 'flashtext' as const
    };
  }

  /**
   * ROI計算関連設定
   */
  get roi() {
    const defaultWeights = { w1: 0.35, w2: 0.35, w3: 0.15, w4: 0.15 };
    const weights = this._config.get<typeof defaultWeights>('roi.weights', defaultWeights);
    
    // 重みの合計が1.0を超えないように正規化
    const total = weights.w1 + weights.w2 + weights.w3 + weights.w4;
    if (total > 1.0) {
      const scale = 1.0 / total;
      return {
        weights: {
          w1: weights.w1 * scale,
          w2: weights.w2 * scale,
          w3: weights.w3 * scale,
          w4: weights.w4 * scale
        }
      };
    }
    
    return { weights };
  }

  /**
   * LLM関連設定
   */
  get llm() {
    return {
      enabled: this._config.get<boolean>('llm.enabled', false),
      backend: this._config.get<'wasm' | 'node'>('llm.backend', 'wasm'),
      modelPath: this._config.get<string>('llm.modelPath', '')
    };
  }

  /**
   * 引用関連設定
   */
  get citations() {
    return {
      googleBooks: {
        apiKey: this._config.get<string>('citations.googleBooks.apiKey', '')
      }
    };
  }

  /**
   * スタイル関連設定
   */
  get style() {
    return {
      dictionaryPath: this._config.get<string>('style.dictionaryPath', '')
    };
  }

  /**
   * 引用スタイル関連設定
   */
  get citationStyle() {
    return {
      active: this._config.get<string>('citationStyle.active', 'デフォルト'),
      packPaths: this._config.get<string[]>('citationStyle.packPaths', []),
      autoFix: {
        enabled: this._config.get<boolean>('citationStyle.autoFix.enabled', false)
      },
      diffMode: this._config.get<'unified' | 'side-by-side'>('citationStyle.diffMode', 'unified')
    };
  }

  /**
   * プライバシー関連設定
   */
  get privacy() {
    return {
      anonymizeBeforeSend: this._config.get<boolean>('privacy.anonymizeBeforeSend', true)
    };
  }

  /**
   * パフォーマンス関連設定
   */
  get performance() {
    return {
      maxWorkers: Math.max(1, Math.min(4, this._config.get<number>('performance.maxWorkers', 2)))
    };
  }

  /**
   * UI関連設定
   */
  get ui() {
    return {
      preview: {
        headChars: Math.max(10, Math.min(120, this._config.get<number>('ui.preview.headChars', 40)))
      }
    };
  }

  /**
   * 設定値を更新
   * @param key 設定キー（ドット記法）
   * @param value 設定値
   * @param target 更新対象（Global/Workspace/WorkspaceFolder）
   */
  public async updateSetting<T>(
    key: string, 
    value: T, 
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace
  ): Promise<void> {
    await this._config.update(key, value, target);
  }

  /**
   * 設定変更監視
   * @param callback 設定変更時のコールバック
   * @returns Disposable
   */
  public onDidChange(callback: (settings: Settings) => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('criticalWritingJp')) {
        // 設定が変更された場合、新しいSettingsインスタンスを作成してコールバックを呼び出す
        callback(new Settings());
      }
    });
  }

  /**
   * 全設定をオブジェクトとして取得（デバッグ用）
   */
  public toObject() {
    return {
      counting: this.counting,
      keyword: this.keyword,
      roi: this.roi,
      llm: this.llm,
      citations: this.citations,
      style: this.style,
      citationStyle: this.citationStyle,
      privacy: this.privacy,
      performance: this.performance,
      ui: this.ui
    };
  }

  /**
   * 設定の妥当性をチェック
   * @returns エラーメッセージの配列（エラーがない場合は空配列）
   */
  public validate(): string[] {
    const errors: string[] = [];

    // 文字数閾値の妥当性チェック
    const { min, max } = this.counting.threshold;
    if (min >= max) {
      errors.push('最小文字数閾値は最大文字数閾値より小さい必要があります');
    }

    // ROI重みの妥当性チェック
    const { weights } = this.roi;
    const total = weights.w1 + weights.w2 + weights.w3 + weights.w4;
    if (total < 0.1 || total > 2.0) {
      errors.push('ROI重みの合計は0.1以上2.0以下である必要があります');
    }

    // LLM設定の妥当性チェック
    const { enabled, modelPath } = this.llm;
    if (enabled && !modelPath.trim()) {
      errors.push('LLM機能が有効な場合、モデルパスを指定する必要があります');
    }

    return errors;
  }
}