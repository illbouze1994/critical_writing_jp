/**
 * Mock for roi-engine
 */

export const roiEngine = {
  calculateROI: jest.fn().mockImplementation((paragraphs: any[], keywords: Map<string, any>, weights: any) => {
    const result = new Map();
    for (const paragraph of paragraphs) {
      result.set(paragraph.id, {
        total: 0.75,
        breakdown: {
          w1: 0.8,  // 文字数適正度
          w2: 0.7,  // キーワード密度
          w3: 0.6,  // ディスコースマーカー
          w4: 0.9   // 引用密度
        }
      });
    }
    return result;
  })
};