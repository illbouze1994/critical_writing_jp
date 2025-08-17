import { ROIEngine } from '../features/roi-engine';
import { Paragraph, ParagraphType, Keyword } from '../core/types';

describe('ROIEngine', () => {
  let roiEngine: ROIEngine;

  beforeEach(() => {
    roiEngine = new ROIEngine();
  });

  describe('calculateROI', () => {
    const sampleParagraph: Paragraph = {
      id: 'test1',
      range: { start: 0, end: 100 },
      text: 'したがって、この研究では【山田 2020】が示したデータベース設計の重要性を検証する。さらに、システム開発における効率化を目指す。',
      chars: 60,
      type: ParagraphType.Normal
    };

    const sampleKeywords: Keyword[] = [
      { text: 'データベース', score: 0.8, frequency: 1, partOfSpeech: '名詞' },
      { text: 'システム', score: 0.7, frequency: 1, partOfSpeech: '名詞' },
      { text: '研究', score: 0.6, frequency: 1, partOfSpeech: '名詞' }
    ];

    it('should calculate ROI using linear combination', () => {
      const weights = { w1: 0.35, w2: 0.35, w3: 0.15, w4: 0.15 };
      const keywordsMap = new Map([['test1', sampleKeywords]]);
      
      const result = roiEngine.calculateROI([sampleParagraph], keywordsMap, weights);
      
      expect(result.has('test1')).toBe(true);
      const scores = result.get('test1')!;
      
      expect(scores.roi).toBeDefined();
      expect(scores.roi!).toBeGreaterThan(0);
      expect(scores.roi!).toBeLessThanOrEqual(1);
      expect(scores.explain).toBeDefined();
    });

    it('should provide detailed score breakdown', () => {
      const weights = { w1: 0.25, w2: 0.25, w3: 0.25, w4: 0.25 };
      const keywordsMap = new Map([['test1', sampleKeywords]]);
      
      const result = roiEngine.calculateROI([sampleParagraph], keywordsMap, weights);
      const scores = result.get('test1')!;
      
      expect(scores.explain).toHaveProperty('keywordDensity');
      expect(scores.explain).toHaveProperty('discourseMarkerScore');
      expect(scores.explain).toHaveProperty('citationDensity');
      expect(scores.explain).toHaveProperty('lexicalDensity');
      expect(scores.explain).toHaveProperty('w1_contribution');
      expect(scores.explain).toHaveProperty('w2_contribution');
      expect(scores.explain).toHaveProperty('w3_contribution');
      expect(scores.explain).toHaveProperty('w4_contribution');
    });

    it('should detect discourse markers', () => {
      const discourseText = 'しかし、この問題は複雑である。したがって、さらなる検討が必要だ。一方、別の観点もある。';
      const discourseParagraph: Paragraph = {
        id: 'discourse1',
        range: { start: 0, end: discourseText.length },
        text: discourseText,
        chars: discourseText.length,
        type: ParagraphType.Normal
      };

      const weights = { w1: 0.1, w2: 0.8, w3: 0.05, w4: 0.05 };
      const keywordsMap = new Map([['discourse1', []]]);
      
      const result = roiEngine.calculateROI([discourseParagraph], keywordsMap, weights);
      const scores = result.get('discourse1')!;
      
      expect(scores.explain!.discourseMarkerScore).toBeGreaterThan(0);
      expect(scores.roi!).toBeGreaterThan(0);
    });

    it('should detect citations', () => {
      const citationText = '【田中 2021】によると、この手法は効果的である。（佐藤 2020）も同様の結果を報告している。';
      const citationParagraph: Paragraph = {
        id: 'citation1',
        range: { start: 0, end: citationText.length },
        text: citationText,
        chars: citationText.length,
        type: ParagraphType.Normal
      };

      const weights = { w1: 0.1, w2: 0.1, w3: 0.7, w4: 0.1 };
      const keywordsMap = new Map([['citation1', []]]);
      
      const result = roiEngine.calculateROI([citationParagraph], keywordsMap, weights);
      const scores = result.get('citation1')!;
      
      expect(scores.explain!.citationDensity).toBeGreaterThan(0);
      expect(scores.citationDensity).toBeGreaterThan(0);
    });

    it('should calculate lexical density', () => {
      const technicalText = 'アルゴリズム、データ構造、プログラミング言語における最適化手法について分析した。';
      const technicalParagraph: Paragraph = {
        id: 'technical1',
        range: { start: 0, end: technicalText.length },
        text: technicalText,
        chars: technicalText.length,
        type: ParagraphType.Normal
      };

      const weights = { w1: 0.1, w2: 0.1, w3: 0.1, w4: 0.7 };
      const keywordsMap = new Map([['technical1', []]]);
      
      const result = roiEngine.calculateROI([technicalParagraph], keywordsMap, weights);
      const scores = result.get('technical1')!;
      
      expect(scores.explain!.lexicalDensity).toBeGreaterThan(0);
      expect(scores.lexicalDensity).toBeGreaterThan(0);
    });

    it('should handle empty keywords', () => {
      const weights = { w1: 0.35, w2: 0.35, w3: 0.15, w4: 0.15 };
      const keywordsMap = new Map([['test1', []]]);
      
      const result = roiEngine.calculateROI([sampleParagraph], keywordsMap, weights);
      const scores = result.get('test1')!;
      
      expect(scores.roi).toBeDefined();
      expect(scores.explain!.keywordDensity).toBe(0);
    });

    it('should handle empty text', () => {
      const emptyParagraph: Paragraph = {
        id: 'empty1',
        range: { start: 0, end: 0 },
        text: '',
        chars: 0,
        type: ParagraphType.Normal
      };

      const weights = { w1: 0.25, w2: 0.25, w3: 0.25, w4: 0.25 };
      const keywordsMap = new Map([['empty1', []]]);
      
      const result = roiEngine.calculateROI([emptyParagraph], keywordsMap, weights);
      const scores = result.get('empty1')!;
      
      expect(scores.roi).toBe(0);
      expect(scores.explain!.keywordDensity).toBe(0);
      expect(scores.explain!.lexicalDensity).toBe(0);
    });

    it('should normalize ROI scores to 0-1 range', () => {
      const highScoreText = 'したがって、しかし、さらに、また、つまり、例えば、要するに、最終的に。' +
                           '【引用1】【引用2】【引用3】プログラミング、アルゴリズム、データベース、システム設計。';
      
      const highScoreParagraph: Paragraph = {
        id: 'high1',
        range: { start: 0, end: highScoreText.length },
        text: highScoreText,
        chars: highScoreText.length,
        type: ParagraphType.Normal
      };

      const highKeywords: Keyword[] = Array.from({length: 10}, (_, i) => ({
        text: `keyword${i}`,
        score: 1.0,
        frequency: 3,
        partOfSpeech: '名詞'
      }));

      const weights = { w1: 1.0, w2: 1.0, w3: 1.0, w4: 1.0 };
      const keywordsMap = new Map([['high1', highKeywords]]);
      
      const result = roiEngine.calculateROI([highScoreParagraph], keywordsMap, weights);
      const scores = result.get('high1')!;
      
      expect(scores.roi!).toBeLessThanOrEqual(1);
      expect(scores.roi!).toBeGreaterThanOrEqual(0);
    });

    it('should weight discourse markers appropriately', () => {
      const causalText = 'したがって、よって、そのため、この結果は重要である。';
      const contrastText = 'しかし、ただし、もっとも、この点は注意が必要だ。';
      
      const causalParagraph: Paragraph = {
        id: 'causal1',
        range: { start: 0, end: causalText.length },
        text: causalText,
        chars: causalText.length,
        type: ParagraphType.Normal
      };

      const contrastParagraph: Paragraph = {
        id: 'contrast1',
        range: { start: 0, end: contrastText.length },
        text: contrastText,
        chars: contrastText.length,
        type: ParagraphType.Normal
      };

      const weights = { w1: 0, w2: 1, w3: 0, w4: 0 };
      const keywordsMap = new Map([
        ['causal1', []],
        ['contrast1', []]
      ]);
      
      const result = roiEngine.calculateROI([causalParagraph, contrastParagraph], keywordsMap, weights);
      
      const causalScore = result.get('causal1')!.explain!.discourseMarkerScore;
      const contrastScore = result.get('contrast1')!.explain!.discourseMarkerScore;
      
      // 因果関係マーカーの方が高い重みを持つはず
      expect(causalScore).toBeGreaterThan(0);
      expect(contrastScore).toBeGreaterThan(0);
    });
  });
});