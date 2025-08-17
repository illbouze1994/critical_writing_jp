/**
 * Mock for keyword-engine
 */

export const keywordEngine = {
  extractKeywords: jest.fn().mockImplementation(async (paragraphs: any[], mode: string = 'rules') => {
    const result = new Map();
    for (const paragraph of paragraphs) {
      result.set(paragraph.id, [
        { text: 'テスト', score: 0.8, frequency: 1, partOfSpeech: '名詞' },
        { text: 'キーワード', score: 0.7, frequency: 1, partOfSpeech: '名詞' }
      ]);
    }
    return result;
  })
};