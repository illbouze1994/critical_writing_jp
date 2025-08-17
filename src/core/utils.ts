/**
 * デバウンス関数
 * 連続して呼び出された場合、最後の呼び出しから指定時間経過後に実行
 * @param fn 実行する関数
 * @param ms 遅延時間（ミリ秒）
 * @returns デバウンス処理された関数
 */
export function debounce<F extends (...args: any[]) => void>(
  fn: F,
  ms: number
): (...args: Parameters<F>) => void {
  let timeoutId: NodeJS.Timeout | undefined;
  
  return (...args: Parameters<F>) => {
    // 既存のタイマーをクリア
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    
    // 新しいタイマーをセット
    timeoutId = setTimeout(() => {
      timeoutId = undefined;
      fn(...args);
    }, ms);
  };
}

/**
 * スロットル関数
 * 指定した間隔以下では実行されないように制御
 * @param fn 実行する関数
 * @param ms 最小実行間隔（ミリ秒）
 * @returns スロットル処理された関数
 */
export function throttle<F extends (...args: any[]) => void>(
  fn: F,
  ms: number
): (...args: Parameters<F>) => void {
  let lastExecuted = 0;
  let timeoutId: NodeJS.Timeout | undefined;
  
  return (...args: Parameters<F>) => {
    const now = Date.now();
    const elapsed = now - lastExecuted;
    
    if (elapsed >= ms) {
      // 十分な時間が経過している場合は即座に実行
      lastExecuted = now;
      fn(...args);
    } else if (timeoutId === undefined) {
      // まだ実行できないが、将来の実行をスケジュール
      timeoutId = setTimeout(() => {
        lastExecuted = Date.now();
        timeoutId = undefined;
        fn(...args);
      }, ms - elapsed);
    }
  };
}

/**
 * 文字列をNFKC正規化
 * 全角半角の統一、合成文字の正規化を行う
 * @param text 正規化する文字列
 * @returns 正規化された文字列
 */
export function normalizeText(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }
  return text.normalize('NFKC');
}

/**
 * 文字数をカウント（正規化後）
 * 視覚的な文字数をカウントする
 * @param text 対象文字列
 * @returns 文字数
 */
export function countChars(text: string): number {
  return normalizeText(text).length;
}

/**
 * SHA-1ハッシュを計算（簡易版）
 * Node.js標準ライブラリを使用してハッシュ値を生成
 * @param text ハッシュ化する文字列
 * @returns ハッシュ値（16進数文字列）
 */
export function sha1(text: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha1').update(text, 'utf8').digest('hex');
}

/**
 * 簡易LRUキャッシュクラス
 * 指定したサイズとTTLでキャッシュを管理
 */
export class SimpleLRU<K, V> {
  private readonly _map = new Map<K, { value: V; timestamp: number }>();
  
  constructor(
    private readonly _maxSize: number = 128,
    private readonly _ttlMs: number = 5 * 60 * 1000 // 5分
  ) {}

  /**
   * 値を取得
   * @param key キー
   * @returns 値（存在しないかTTL切れの場合はundefined）
   */
  get(key: K): V | undefined {
    const entry = this._map.get(key);
    if (!entry) {
      return undefined;
    }

    // TTLチェック
    if (Date.now() - entry.timestamp > this._ttlMs) {
      this._map.delete(key);
      return undefined;
    }

    // LRU更新（最後に使用したものとしてマーク）
    this._map.delete(key);
    this._map.set(key, { value: entry.value, timestamp: Date.now() });
    
    return entry.value;
  }

  /**
   * 値を設定
   * @param key キー
   * @param value 値
   */
  set(key: K, value: V): void {
    // 既存エントリがある場合は削除
    if (this._map.has(key)) {
      this._map.delete(key);
    }

    // 新しいエントリを追加
    this._map.set(key, { value, timestamp: Date.now() });

    // サイズ制限チェック
    if (this._map.size > this._maxSize) {
      // 最も古いエントリ（最初のエントリ）を削除
      const firstKey = this._map.keys().next().value;
      if (firstKey !== undefined) {
        this._map.delete(firstKey);
      }
    }
  }

  /**
   * キャッシュをクリア
   */
  clear(): void {
    this._map.clear();
  }

  /**
   * 現在のキャッシュサイズ
   */
  get size(): number {
    return this._map.size;
  }
}