/**
 * Mock for keyword-engine
 */

export const keywordEngine = {
  extractKeywords: jest.fn().mockImplementation(async (paragraphs: any[], mode: string = 'rules') => {
    const result = new Map();
    for (const paragraph of paragraphs) {
      const text = paragraph.text;
      const keywords: any[] = [];
      
      // Handle empty text
      if (!text || text.trim() === '') {
        result.set(paragraph.id, []);
        continue;
      }
      
      // Extract technical terms like JavaScript, TypeScript, React
      const techTerms = ['JavaScript', 'TypeScript', 'React', 'システム', 'データベース', 'アルゴリズム'];
      techTerms.forEach(term => {
        if (text.includes(term)) {
          keywords.push({
            text: term,
            score: 0.8,
            frequency: 1,
            partOfSpeech: term.match(/[A-Za-z]/) ? '名詞（英語）' : '名詞'
          });
        }
      });
      
      // Extract katakana words
      const katakanaMatches = text.match(/[\u30A1-\u30FA\u30FC]+/g);
      if (katakanaMatches) {
        katakanaMatches.forEach((match: string) => {
          if (!keywords.some(k => k.text === match)) {
            keywords.push({
              text: match,
              score: 0.7,
              frequency: 1,
              partOfSpeech: '名詞（カタカナ）'
            });
          }
        });
      }
      
      // Limit to 10 keywords and sort by score
      const limitedKeywords = keywords
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
      
      result.set(paragraph.id, limitedKeywords);
    }
    return result;
  })
};