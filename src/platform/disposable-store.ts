import * as vscode from 'vscode';

/**
 * 複数のDisposableをまとめて管理するクラス
 * 拡張機能の終了時に確実にリソースを解放するために使用
 */
export class DisposableStore implements vscode.Disposable {
  private readonly _disposables: vscode.Disposable[] = [];
  private _isDisposed = false;

  /**
   * Disposableオブジェクトをストアに追加
   * @param disposable 追加するDisposableオブジェクト
   * @returns 追加されたDisposableオブジェクト（チェーン可能）
   */
  public add<T extends vscode.Disposable>(disposable: T): T {
    if (this._isDisposed) {
      // 既に破棄されている場合は即座に破棄
      try {
        disposable.dispose();
      } catch (error) {
        // 破棄時のエラーは無視（ログ出力のみ）
        console.warn('[DisposableStore] Error disposing late-added disposable:', error);
      }
      return disposable;
    }

    this._disposables.push(disposable);
    return disposable;
  }

  /**
   * すべてのDisposableオブジェクトを破棄
   */
  public dispose(): void {
    if (this._isDisposed) {
      return;
    }

    this._isDisposed = true;

    // 逆順で破棄（後に追加されたものから先に破棄）
    while (this._disposables.length > 0) {
      const disposable = this._disposables.pop();
      if (disposable) {
        try {
          disposable.dispose();
        } catch (error) {
          // 個別の破棄エラーは無視して処理を継続
          console.warn('[DisposableStore] Error disposing resource:', error);
        }
      }
    }
  }

  /**
   * 現在管理しているDisposableの数を取得
   */
  public get size(): number {
    return this._disposables.length;
  }

  /**
   * ストアが既に破棄されているかどうかを確認
   */
  public get isDisposed(): boolean {
    return this._isDisposed;
  }
}