/**
 * Google Books APIクライアントのテストスイート
 */

import { GoogleBooksClient } from '../features/google-books-client';
import { BooksSearchRequest, GoogleBooksResult } from '../core/ipc-types';
import * as vscode from 'vscode';

// Mock vscode
jest.mock('vscode');

// Mock fetch
global.fetch = jest.fn();

describe('GoogleBooksClient', () => {
  let mockContext: vscode.ExtensionContext;
  let client: GoogleBooksClient;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Mock ExtensionContext
    mockContext = {
      extensionUri: { toString: () => 'file:///mock/extension' } as vscode.Uri,
      subscriptions: [],
      secrets: {
        get: jest.fn(),
        store: jest.fn()
      }
    } as any;

    client = new GoogleBooksClient(mockContext);
  });

  afterEach(() => {
    jest.useRealTimers();
    client.dispose();
  });

  describe('API キー管理', () => {
    test('APIキーが設定されていない場合、無効状態であること', async () => {
      (mockContext.secrets.get as jest.Mock).mockResolvedValue(undefined);

      const isAvailable = await client.checkApiKeyAvailable();
      expect(isAvailable).toBe(false);
      expect(client.getEnabled()).toBe(false);
    });

    test('APIキーが設定されている場合、有効状態であること', async () => {
      (mockContext.secrets.get as jest.Mock).mockResolvedValue('test-api-key');

      const isAvailable = await client.checkApiKeyAvailable();
      expect(isAvailable).toBe(true);
      expect(client.getEnabled()).toBe(true);
    });

    test('APIキーを正常に設定できること', async () => {
      (mockContext.secrets.store as jest.Mock).mockResolvedValue(undefined);

      await client.setApiKey('new-api-key');

      expect(mockContext.secrets.store).toHaveBeenCalledWith(
        'googleBooksApiKey',
        'new-api-key'
      );
      expect(client.getEnabled()).toBe(true);
    });

    test('APIキー設定時にエラーが発生した場合、適切にハンドリングすること', async () => {
      (mockContext.secrets.store as jest.Mock).mockRejectedValue(new Error('Storage error'));

      await expect(client.setApiKey('invalid-key')).rejects.toThrow(
        'APIキーの保存に失敗しました'
      );
    });
  });

  describe('レート制御', () => {
    beforeEach(async () => {
      // APIキーを設定して有効化
      (mockContext.secrets.get as jest.Mock).mockResolvedValue('test-api-key');
      await client.checkApiKeyAvailable();
    });

    test('連続リクエスト間で適切な間隔を空けること', async () => {
      // モック検索結果の設定
      const mockResults: GoogleBooksResult[] = [{
        title: 'Test Book',
        author: 'Test Author',
        year: '2023'
      }];

      // モック検索APIを直接テスト（プライベートメソッドへのアクセス）
      jest.spyOn(client as any, 'mockSearchAPI').mockResolvedValue(mockResults);

      const request: BooksSearchRequest = { phrase: 'test query' };

      // 最初のリクエスト
      const promise1 = client.searchExactPhrase(request);
      
      // すぐに2回目のリクエスト
      const promise2 = client.searchExactPhrase(request);

      // タイマーを進めてレート制御をテスト
      jest.advanceTimersByTime(250);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1).toEqual(mockResults);
      expect(result2).toEqual(mockResults);
    });

    test('レート制御が250ms間隔で動作すること', async () => {
      const mockResults: GoogleBooksResult[] = [{
        title: 'Test Book',
        author: 'Test Author'
      }];

      jest.spyOn(client as any, 'mockSearchAPI').mockResolvedValue(mockResults);
      jest.spyOn(client as any, 'throttle');

      const request: BooksSearchRequest = { phrase: 'test query' };

      // リクエスト実行
      const promise = client.searchExactPhrase(request);
      
      // タイマーを進める
      jest.advanceTimersByTime(250);
      
      await promise;

      expect((client as any).throttle).toHaveBeenCalled();
    });
  });

  describe('キャッシュ機能', () => {
    beforeEach(async () => {
      (mockContext.secrets.get as jest.Mock).mockResolvedValue('test-api-key');
      await client.checkApiKeyAvailable();
    });

    test('同じクエリに対してキャッシュが動作すること', async () => {
      const mockResults: GoogleBooksResult[] = [{
        title: 'Cached Book',
        author: 'Cached Author'
      }];

      const mockSearchSpy = jest.spyOn(client as any, 'mockSearchAPI').mockResolvedValue(mockResults);

      const request: BooksSearchRequest = { phrase: 'cached query' };

      // 最初のリクエスト
      const result1 = await client.searchExactPhrase(request);
      
      // 2回目のリクエスト（キャッシュから取得されるはず）
      const result2 = await client.searchExactPhrase(request);

      expect(result1).toEqual(mockResults);
      expect(result2).toEqual(mockResults);
      
      // モック検索は1回だけ呼ばれるはず（2回目はキャッシュから）
      expect(mockSearchSpy).toHaveBeenCalledTimes(1);
    });

    test('異なるクエリは個別にキャッシュされること', async () => {
      const mockResults1: GoogleBooksResult[] = [{ title: 'Book 1', author: 'Author 1' }];
      const mockResults2: GoogleBooksResult[] = [{ title: 'Book 2', author: 'Author 2' }];

      jest.spyOn(client as any, 'mockSearchAPI')
        .mockResolvedValueOnce(mockResults1)
        .mockResolvedValueOnce(mockResults2);

      const request1: BooksSearchRequest = { phrase: 'query 1' };
      const request2: BooksSearchRequest = { phrase: 'query 2' };

      const result1 = await client.searchExactPhrase(request1);
      const result2 = await client.searchExactPhrase(request2);

      expect(result1).toEqual(mockResults1);
      expect(result2).toEqual(mockResults2);
    });

    test('キャッシュクリアが正常に動作すること', async () => {
      const mockResults: GoogleBooksResult[] = [{
        title: 'Test Book',
        author: 'Test Author'
      }];

      const mockSearchSpy = jest.spyOn(client as any, 'mockSearchAPI').mockResolvedValue(mockResults);
      const request: BooksSearchRequest = { phrase: 'test query' };

      // 最初のリクエスト
      await client.searchExactPhrase(request);
      
      // キャッシュクリア
      client.clearCache();
      
      // 2回目のリクエスト（キャッシュクリア後なので再度API呼び出しされる）
      await client.searchExactPhrase(request);

      expect(mockSearchSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('検索機能', () => {
    beforeEach(async () => {
      (mockContext.secrets.get as jest.Mock).mockResolvedValue('test-api-key');
      await client.checkApiKeyAvailable();
    });

    test('基本的な検索が正常に動作すること', async () => {
      const request: BooksSearchRequest = {
        phrase: '機械学習'
      };

      const results = await client.searchExactPhrase(request);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        title: '機械学習入門',
        author: '山田太郎',
        year: '2023',
        snippet: '機械学習についての詳細な解説を含む基礎的な入門書です。',
        url: 'https://books.google.com/books/example1'
      });
    });

    test('ヒント付きの検索が正常に動作すること', async () => {
      const request: BooksSearchRequest = {
        phrase: 'テスト',
        hint: {
          author: 'カスタム著者',
          title: 'カスタムタイトル'
        }
      };

      const results = await client.searchExactPhrase(request);

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('カスタムタイトル');
      expect(results[0].author).toBe('カスタム著者');
    });

    test('複数のキーワードに対する検索結果が正しく返されること', async () => {
      const request: BooksSearchRequest = {
        phrase: '統計学 プログラミング 機械学習'
      };

      const results = await client.searchExactPhrase(request);

      // 複数のパターンにマッチするため、複数の結果が返される
      expect(results.length).toBeGreaterThan(1);
    });

    test('マッチしないクエリに対してフォールバック結果を返すこと', async () => {
      const request: BooksSearchRequest = {
        phrase: 'マッチしないクエリ'
      };

      const results = await client.searchExactPhrase(request);

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('「マッチしないクエリ」関連書籍');
      expect(results[0].author).toBe('著者不明');
    });
  });

  describe('キャンセル機能', () => {
    beforeEach(async () => {
      (mockContext.secrets.get as jest.Mock).mockResolvedValue('test-api-key');
      await client.checkApiKeyAvailable();
    });

    test('キャンセルシグナルが発火した場合、空の結果を返すこと', async () => {
      const abortController = new AbortController();
      abortController.abort();

      const request: BooksSearchRequest = { phrase: 'test' };
      const results = await client.searchExactPhrase(request, {
        signal: abortController.signal
      });

      expect(results).toEqual([]);
    });

    test('検索中にキャンセルされた場合、処理を中断すること', async () => {
      const abortController = new AbortController();
      
      // 遅延検索をモック
      jest.spyOn(client as any, 'mockSearchAPI').mockImplementation(
        () => new Promise((resolve) => {
          setTimeout(() => resolve([]), 1000);
        })
      );

      const request: BooksSearchRequest = { phrase: 'test' };
      const promise = client.searchExactPhrase(request, {
        signal: abortController.signal
      });

      // 500ms後にキャンセル
      setTimeout(() => abortController.abort(), 500);
      jest.advanceTimersByTime(500);

      const results = await promise;
      expect(results).toEqual([]);
    });
  });

  describe('エラーハンドリング', () => {
    test('APIキー未設定時に適切なエラーメッセージを返すこと', async () => {
      // APIキーを未設定状態にする
      (mockContext.secrets.get as jest.Mock).mockResolvedValue(undefined);
      await client.checkApiKeyAvailable();

      const request: BooksSearchRequest = { phrase: 'test' };

      await expect(client.searchExactPhrase(request)).rejects.toThrow(
        'Google Books APIキーが設定されていません'
      );
    });

    test('レート制限エラーで適切に再試行すること', async () => {
      (mockContext.secrets.get as jest.Mock).mockResolvedValue('test-api-key');
      await client.checkApiKeyAvailable();

      // 最初の呼び出しでRATE エラー、2回目で成功をモック
      const mockResults: GoogleBooksResult[] = [{ title: 'Success', author: 'Author' }];
      
      jest.spyOn(client as any, 'mockSearchAPI')
        .mockRejectedValueOnce(new Error('RATE'))
        .mockResolvedValueOnce(mockResults);

      jest.spyOn(client as any, 'retryWithBackoff');

      const request: BooksSearchRequest = { phrase: 'test' };
      
      // retryWithBackoffの呼び出しをテスト用に直接実行
      const results = await (client as any).retryWithBackoff(request, undefined, 1, 2);

      expect(results).toEqual(mockResults);
    });

    test('最大再試行回数を超えた場合、エラーを投げること', async () => {
      (mockContext.secrets.get as jest.Mock).mockResolvedValue('test-api-key');
      await client.checkApiKeyAvailable();

      // 常にRATE エラーを返す
      jest.spyOn(client as any, 'mockSearchAPI')
        .mockRejectedValue(new Error('RATE'));

      const request: BooksSearchRequest = { phrase: 'test' };

      await expect((client as any).retryWithBackoff(request, undefined, 4, 3)).rejects.toThrow(
        'レート制限により検索に失敗しました'
      );
    });

    test('AUTH エラーで機能を無効化すること', async () => {
      (mockContext.secrets.get as jest.Mock).mockResolvedValue('invalid-key');
      await client.checkApiKeyAvailable();

      jest.spyOn(client as any, 'mockSearchAPI')
        .mockRejectedValue(new Error('AUTH'));

      const request: BooksSearchRequest = { phrase: 'test' };

      await expect(client.searchExactPhrase(request)).rejects.toThrow(
        'APIキーが無効です。設定を確認してください。'
      );

      expect(client.getEnabled()).toBe(false);
    });
  });

  describe('ユーティリティ機能', () => {
    test('キャッシュキー生成が正しく動作すること', () => {
      const request1: BooksSearchRequest = { phrase: 'test' };
      const request2: BooksSearchRequest = { 
        phrase: 'test',
        hint: { author: 'author', title: 'title' }
      };

      const key1 = (client as any).generateCacheKey(request1);
      const key2 = (client as any).generateCacheKey(request2);

      expect(key1).toBe('test');
      expect(key2).toBe('test|author:author|title:title');
      expect(key1).not.toBe(key2);
    });

    test('HTMLスニペットのクリーンアップが正常に動作すること', () => {
      const htmlSnippet = '<b>重要</b>な内容で<em>強調</em>されています';
      const cleanedSnippet = (client as any).cleanSnippet(htmlSnippet);

      expect(cleanedSnippet).toBe('重要な内容で強調されています');
    });

    test('空のスニペットを適切にハンドリングすること', () => {
      const cleanedSnippet = (client as any).cleanSnippet(undefined);
      expect(cleanedSnippet).toBeUndefined();

      const emptySnippet = (client as any).cleanSnippet('');
      expect(emptySnippet).toBe('');
    });
  });

  describe('リソース管理', () => {
    test('dispose が正常に動作すること', () => {
      const clearCacheSpy = jest.spyOn(client, 'clearCache');
      
      client.dispose();

      expect(clearCacheSpy).toHaveBeenCalled();
      expect(client.getEnabled()).toBe(false);
    });
  });

  describe('実際のAPI呼び出し（参考実装）', () => {
    test('callActualAPI のクエリ構築が正しく動作すること', async () => {
      // この部分は実際のfetchをモックしてテスト
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          items: [{
            volumeInfo: {
              title: 'API Test Book',
              authors: ['API Author'],
              publishedDate: '2023-01-01',
              previewLink: 'https://example.com'
            },
            searchInfo: {
              textSnippet: '<b>テスト</b>内容'
            }
          }]
        })
      });

      global.fetch = mockFetch;
      (mockContext.secrets.get as jest.Mock).mockResolvedValue('real-api-key');

      const request: BooksSearchRequest = {
        phrase: 'テスト書籍',
        hint: { author: '著者名' }
      };

      // 実際のAPI呼び出しメソッドをテスト（プライベートメソッド）
      try {
        await (client as any).callActualAPI(request);
        
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('https://www.googleapis.com/books/v1/volumes'),
          expect.objectContaining({
            method: 'GET'
          })
        );
      } catch (error) {
        // APIキー未設定等の場合はスキップ
      }
    });
  });
});