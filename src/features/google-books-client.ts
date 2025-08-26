/**
 * Google Books API統合機能
 * 書籍引用の照合と補完を提供する
 */

import * as vscode from 'vscode';
import { GoogleBooksResult, BooksSearchRequest, CancelInfo } from '../core/ipc-types';

/**
 * 簡易LRUキャッシュの実装
 */
class SimpleLRU<K, V> {
  private data = new Map<K, { value: V; timestamp: number }>();

  constructor(
    private maxSize: number = 128,
    private ttlMs: number = 5 * 60 * 1000 // 5分
  ) {}

  get(key: K): V | undefined {
    const entry = this.data.get(key);
    if (!entry) {
      return undefined;
    }

    // TTL チェック
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.data.delete(key);
      return undefined;
    }

    // LRU更新: 削除して再追加で最後に移動
    this.data.delete(key);
    this.data.set(key, { value: entry.value, timestamp: Date.now() });
    return entry.value;
  }

  set(key: K, value: V): void {
    // 既存エントリがあれば削除
    if (this.data.has(key)) {
      this.data.delete(key);
    }

    // サイズ制限チェック
    if (this.data.size >= this.maxSize) {
      const oldestKey = this.data.keys().next().value;
      if (oldestKey !== undefined) {
        this.data.delete(oldestKey);
      }
    }

    this.data.set(key, { value, timestamp: Date.now() });
  }

  clear(): void {
    this.data.clear();
  }
}

/**
 * Google Books API クライアント
 */
export class GoogleBooksClient {
  private static readonly BASE_URL = 'https://www.googleapis.com/books/v1/volumes';
  private static readonly RATE_LIMIT_MS = 250; // 250msに1回（1秒間に4回）

  private cache = new SimpleLRU<string, GoogleBooksResult[]>(128, 5 * 60 * 1000);
  private lastCallTime = 0;
  private isEnabled = false;

  constructor(private context: vscode.ExtensionContext) {}

  /**
   * APIキーが設定されているかチェック
   */
  async checkApiKeyAvailable(): Promise<boolean> {
    try {
      const apiKey = await this.context.secrets.get('googleBooksApiKey');
      this.isEnabled = !!apiKey;
      return this.isEnabled;
    } catch (error) {
      console.error('[GoogleBooksClient] Failed to check API key:', error);
      this.isEnabled = false;
      return false;
    }
  }

  /**
   * 機能が有効かどうか
   */
  getEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * APIキーを設定
   */
  async setApiKey(apiKey: string): Promise<void> {
    try {
      await this.context.secrets.store('googleBooksApiKey', apiKey);
      this.isEnabled = true;
      console.log('[GoogleBooksClient] API key configured successfully');
    } catch (error) {
      console.error('[GoogleBooksClient] Failed to store API key:', error);
      throw new Error('APIキーの保存に失敗しました');
    }
  }

  /**
   * レート制御
   */
  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastCallTime;
    const wait = Math.max(0, GoogleBooksClient.RATE_LIMIT_MS - elapsed);
    
    if (wait > 0) {
      await new Promise(resolve => setTimeout(resolve, wait));
    }
    
    this.lastCallTime = Date.now();
  }

  /**
   * 正確なフレーズ検索を実行
   */
  async searchExactPhrase(
    request: BooksSearchRequest, 
    cancelInfo?: CancelInfo
  ): Promise<GoogleBooksResult[]> {
    if (!this.isEnabled) {
      throw new Error('Google Books APIキーが設定されていません');
    }

    // キャンセルチェック
    if (cancelInfo?.signal.aborted) {
      return [];
    }

    // キャッシュキーの生成
    const cacheKey = this.generateCacheKey(request);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log(`[GoogleBooksClient] Cache hit for: ${request.phrase}`);
      return cached;
    }

    try {
      // レート制御
      await this.throttle();

      // キャンセルチェック
      if (cancelInfo?.signal.aborted) {
        return [];
      }

      console.log(`[GoogleBooksClient] Searching for: ${request.phrase}`);

      // 実環境では実際のAPI呼び出しを行う
      // const results = await this.callActualAPI(request, cancelInfo);
      
      // モック実装
      const results = await this.mockSearchAPI(request, cancelInfo);

      // キャッシュに保存
      this.cache.set(cacheKey, results);

      return results;

    } catch (error: unknown) {
      console.error('[GoogleBooksClient] Search failed:', error);

      // 特定のエラータイプに応じた処理
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('AUTH')) {
        this.isEnabled = false;
        throw new Error('APIキーが無効です。設定を確認してください。');
      }

      if (errorMessage.includes('RATE')) {
        try {
          // レート制限エラーの場合は指数バックオフで再試行
          return await this.retryWithBackoff(request, cancelInfo);
        } catch (retryError) {
          throw new Error(`書籍検索に失敗しました: ${retryError instanceof Error ? retryError.message : String(retryError)}`);
        }
      }

      if (cancelInfo?.signal.aborted) {
        return [];
      }

      throw new Error(`書籍検索に失敗しました: ${errorMessage}`);
    }
  }

  /**
   * 指数バックオフによる再試行
   */
  private async retryWithBackoff(
    request: BooksSearchRequest,
    cancelInfo?: CancelInfo,
    attempt: number = 1,
    maxAttempts: number = 3
  ): Promise<GoogleBooksResult[]> {
    if (attempt > maxAttempts) {
      throw new Error('レート制限により検索に失敗しました。しばらく待ってから再試行してください。');
    }

    const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 8000); // 1s, 2s, 4s, 最大8s
    console.log(`[GoogleBooksClient] Rate limited, retrying in ${backoffMs}ms (attempt ${attempt}/${maxAttempts})`);

    await new Promise(resolve => setTimeout(resolve, backoffMs));

    if (cancelInfo?.signal.aborted) {
      return [];
    }

    try {
      return await this.mockSearchAPI(request, cancelInfo);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('RATE')) {
        return this.retryWithBackoff(request, cancelInfo, attempt + 1, maxAttempts);
      }
      throw error;
    }
  }

  /**
   * モック検索API（実装用）
   */
  private async mockSearchAPI(
    request: BooksSearchRequest,
    cancelInfo?: CancelInfo
  ): Promise<GoogleBooksResult[]> {
    // 実際のAPI呼び出し時間をシミュレート
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));

    if (cancelInfo?.signal.aborted) {
      return [];
    }

    // フレーズに基づいてモック結果を生成
    const mockResults: GoogleBooksResult[] = [];
    const phrase = request.phrase.toLowerCase();
    
    // 基本的なマッチングパターン
    if (phrase.includes('機械学習') || phrase.includes('machine learning')) {
      mockResults.push({
        title: '機械学習入門',
        author: '山田太郎',
        year: '2023',
        snippet: `${request.phrase}についての詳細な解説を含む基礎的な入門書です。`,
        url: 'https://books.google.com/books/example1'
      });
    }

    if (phrase.includes('統計') || phrase.includes('statistics')) {
      mockResults.push({
        title: '統計学の基礎',
        author: '田中花子',
        year: '2022',
        snippet: `${request.phrase}の理論と実践的応用を扱った教科書です。`,
        url: 'https://books.google.com/books/example2'
      });
    }

    if (phrase.includes('プログラミング') || phrase.includes('programming')) {
      mockResults.push({
        title: 'プログラミング言語の設計',
        author: '佐藤次郎',
        year: '2024',
        snippet: `${request.phrase}言語の設計原理について論じています。`,
        url: 'https://books.google.com/books/example3'
      });
    }

    // 一般的なフォールバック結果
    if (mockResults.length === 0) {
      mockResults.push({
        title: `「${request.phrase}」関連書籍`,
        author: '著者不明',
        snippet: `${request.phrase}に関連する内容を含む書籍です。`,
        url: 'https://books.google.com/books/general'
      });
    }

    // ヒント情報があれば結果を調整
    if (request.hint?.author) {
      mockResults.forEach(result => {
        if (result.author === '著者不明') {
          result.author = request.hint!.author!;
        }
      });
    }

    if (request.hint?.title) {
      mockResults[0].title = request.hint.title;
    }

    return mockResults.slice(0, 10); // 最大10件まで
  }

  /**
   * 実際のAPI呼び出し（参考実装）
   */
  private async callActualAPI(
    request: BooksSearchRequest,
    cancelInfo?: CancelInfo
  ): Promise<GoogleBooksResult[]> {
    const apiKey = await this.context.secrets.get('googleBooksApiKey');
    if (!apiKey) {
      throw new Error('AUTH');
    }

    // クエリパラメータの構築
    const qParts: string[] = [];
    if (request.phrase) {
      qParts.push(`"${request.phrase}"`);
    }
    if (request.hint?.author) {
      qParts.push(`inauthor:${request.hint.author}`);
    }
    if (request.hint?.title) {
      qParts.push(`intitle:${request.hint.title}`);
    }

    const query = qParts.join('+');
    const url = new URL(GoogleBooksClient.BASE_URL);
    url.searchParams.set('q', query);
    url.searchParams.set('filter', 'partial');
    url.searchParams.set('projection', 'lite');
    url.searchParams.set('langRestrict', 'ja');
    url.searchParams.set('maxResults', '10');
    url.searchParams.set('key', apiKey);

    // タイムアウト設定
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.status === 401 || response.status === 403) {
        throw new Error('AUTH');
      }
      if (response.status === 429) {
        throw new Error('RATE');
      }
      if (!response.ok) {
        throw new Error(`HTTP_${response.status}`);
      }

      const data = await response.json();
      return this.parseAPIResponse(data);

    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * API応答のパース
   */
  private parseAPIResponse(data: any): GoogleBooksResult[] {
    if (!data.items || !Array.isArray(data.items)) {
      return [];
    }

    return data.items.map((item: any) => {
      const volumeInfo = item.volumeInfo || {};
      const searchInfo = item.searchInfo || {};

      return {
        title: volumeInfo.title || '不明なタイトル',
        author: (volumeInfo.authors || ['不明な著者']).join(', '),
        year: volumeInfo.publishedDate?.substring(0, 4),
        snippet: this.cleanSnippet(searchInfo.textSnippet),
        url: volumeInfo.previewLink || volumeInfo.infoLink
      };
    });
  }

  /**
   * スニペットのHTMLタグを除去
   */
  private cleanSnippet(snippet?: string): string {
    if (!snippet) {
      return '';
    }
    return snippet.replace(/<[^>]*>/g, '');
  }

  /**
   * キャッシュキーの生成
   */
  private generateCacheKey(request: BooksSearchRequest): string {
    const parts = [request.phrase];
    if (request.hint?.author) {
      parts.push(`author:${request.hint.author}`);
    }
    if (request.hint?.title) {
      parts.push(`title:${request.hint.title}`);
    }
    return parts.join('|');
  }

  /**
   * キャッシュをクリア
   */
  clearCache(): void {
    this.cache.clear();
    console.log('[GoogleBooksClient] Cache cleared');
  }

  /**
   * リソースのクリーンアップ
   */
  dispose(): void {
    this.clearCache();
    this.isEnabled = false;
  }
}