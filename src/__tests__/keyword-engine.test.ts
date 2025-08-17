import { KeywordEngine } from '../features/keyword-engine';
import { Paragraph, ParagraphType } from '../core/types';

describe('KeywordEngine', () => {
  let keywordEngine: KeywordEngine;

  beforeEach(() => {
    keywordEngine = new KeywordEngine();
  });

  describe('extractKeywords', () => {
    it('should extract keywords in rules mode', async () => {
      const paragraphs: Paragraph[] = [
        {
          id: 'test1',
          range: { start: 0, end: 50 },
          text: 'これはシステムの開発において重要な技術的要素です。データベースとAPIの連携が必要となります。',
          chars: 45,
          type: ParagraphType.Normal
        }
      ];

      const result = await keywordEngine.extractKeywords(paragraphs, 'rules');
      
      expect(result).toBeInstanceOf(Map);
      expect(result.has('test1')).toBe(true);
      
      const keywords = result.get('test1');
      expect(keywords).toBeDefined();
      expect(keywords!.length).toBeGreaterThan(0);
      
      // カタカナ語が抽出されることを確認
      const katakanaKeywords = keywords!.filter(k => /^[\u30A1-\u30FA\u30FC]+$/.test(k.text));
      expect(katakanaKeywords.length).toBeGreaterThan(0);
    });

    it('should extract technical terms', async () => {
      const paragraphs: Paragraph[] = [
        {
          id: 'tech1',
          range: { start: 0, end: 30 },
          text: 'JavaScript、TypeScript、React等の最新技術',
          chars: 25,
          type: ParagraphType.Normal
        }
      ];

      const result = await keywordEngine.extractKeywords(paragraphs, 'rules');
      const keywords = result.get('tech1')!;
      
      // 技術用語が抽出されることを確認
      const techTerms = keywords.map(k => k.text);
      expect(techTerms).toContain('JavaScript');
      expect(techTerms).toContain('TypeScript');
      expect(techTerms).toContain('React');
    });

    it('should filter out stop words', async () => {
      const paragraphs: Paragraph[] = [
        {
          id: 'stop1',
          range: { start: 0, end: 20 },
          text: 'これはとても重要なことです',
          chars: 15,
          type: ParagraphType.Normal
        }
      ];

      const result = await keywordEngine.extractKeywords(paragraphs, 'rules');
      const keywords = result.get('stop1')!;
      
      // ストップワードが除外されることを確認
      const keywordTexts = keywords.map(k => k.text);
      expect(keywordTexts).not.toContain('これ');
      expect(keywordTexts).not.toContain('は');
      expect(keywordTexts).not.toContain('です');
    });

    it('should score keywords appropriately', async () => {
      const paragraphs: Paragraph[] = [
        {
          id: 'score1',
          range: { start: 0, end: 40 },
          text: 'データベース設計における正規化技術の重要性について',
          chars: 30,
          type: ParagraphType.Normal
        }
      ];

      const result = await keywordEngine.extractKeywords(paragraphs, 'rules');
      const keywords = result.get('score1')!;
      
      // スコアが正しく設定されることを確認
      keywords.forEach(keyword => {
        expect(keyword.score).toBeGreaterThan(0);
        expect(keyword.score).toBeLessThanOrEqual(1);
        expect(keyword.frequency).toBeGreaterThan(0);
      });
    });

    it('should handle empty text', async () => {
      const paragraphs: Paragraph[] = [
        {
          id: 'empty1',
          range: { start: 0, end: 0 },
          text: '',
          chars: 0,
          type: ParagraphType.Normal
        }
      ];

      const result = await keywordEngine.extractKeywords(paragraphs, 'rules');
      const keywords = result.get('empty1')!;
      
      expect(keywords).toEqual([]);
    });

    it('should limit keywords to 10 per paragraph', async () => {
      const longText = 'アルゴリズム データベース システム アーキテクチャ フレームワーク ' +
                      'プログラミング インターフェース モジュール コンポーネント ライブラリ ' +
                      'パッケージ デプロイメント インフラストラクチャ セキュリティ パフォーマンス';
      
      const paragraphs: Paragraph[] = [
        {
          id: 'long1',
          range: { start: 0, end: longText.length },
          text: longText,
          chars: longText.length,
          type: ParagraphType.Normal
        }
      ];

      const result = await keywordEngine.extractKeywords(paragraphs, 'rules');
      const keywords = result.get('long1')!;
      
      expect(keywords.length).toBeLessThanOrEqual(10);
    });

    it('should assign part of speech', async () => {
      const paragraphs: Paragraph[] = [
        {
          id: 'pos1',
          range: { start: 0, end: 30 },
          text: 'JavaScript プログラミング 開発性能',
          chars: 20,
          type: ParagraphType.Normal
        }
      ];

      const result = await keywordEngine.extractKeywords(paragraphs, 'rules');
      const keywords = result.get('pos1')!;
      
      keywords.forEach(keyword => {
        expect(keyword.partOfSpeech).toBeDefined();
        expect(keyword.partOfSpeech).toMatch(/名詞/);
      });
    });

    it('should fall back to rules mode for unsupported modes', async () => {
      const paragraphs: Paragraph[] = [
        {
          id: 'fallback1',
          range: { start: 0, end: 20 },
          text: 'テストデータです',
          chars: 10,
          type: ParagraphType.Normal
        }
      ];

      // tfidf モードを指定するが、rules モードにフォールバックされる
      const result = await keywordEngine.extractKeywords(paragraphs, 'tfidf');
      
      expect(result.has('fallback1')).toBe(true);
      // 警告ログが出力されることを確認（console.warn のモック化は省略）
    });
  });
});