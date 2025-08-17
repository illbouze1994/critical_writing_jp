/**
 * Mock for roi-engine
 */

export const roiEngine = {
  calculateROI: jest.fn().mockImplementation((paragraphs: any[], keywords: Map<string, any>, weights: any) => {
    const result = new Map();
    for (const paragraph of paragraphs) {
      const text = paragraph.text;
      const paragraphKeywords = keywords.get(paragraph.id) || [];
      
      // Handle empty text case
      if (!text || text.trim() === '') {
        result.set(paragraph.id, {
          roi: 0,
          keywordDensity: 0,
          discourseMarkerScore: 0,
          citationDensity: 0,
          lexicalDensity: 0,
          explain: {
            keywordDensity: 0,
            discourseMarkerScore: 0,
            citationDensity: 0,
            lexicalDensity: 0,
            w1_contribution: 0,
            w2_contribution: 0,
            w3_contribution: 0,
            w4_contribution: 0
          }
        });
        continue;
      }
      
      // Calculate mock scores based on text content
      const keywordDensity = paragraphKeywords.length > 0 ? 0.7 : 0;
      const discourseMarkerScore = text.includes('したがって') || text.includes('しかし') || text.includes('一方') ? 0.8 : 0.2;
      const citationDensity = text.includes('【') || text.includes('（') ? 0.9 : 0.1;
      const lexicalDensity = Math.min(text.length / 100, 1.0);
      
      // Calculate weighted ROI score
      const roi = (weights.w1 * 0.8) + (weights.w2 * keywordDensity) + 
                  (weights.w3 * discourseMarkerScore) + (weights.w4 * citationDensity);
      
      result.set(paragraph.id, {
        roi: Math.min(roi, 1.0),
        keywordDensity,
        discourseMarkerScore,
        citationDensity,
        lexicalDensity,
        explain: {
          keywordDensity,
          discourseMarkerScore,
          citationDensity,
          lexicalDensity,
          w1_contribution: weights.w1 * 0.8,
          w2_contribution: weights.w2 * keywordDensity,
          w3_contribution: weights.w3 * discourseMarkerScore,
          w4_contribution: weights.w4 * citationDensity
        }
      });
    }
    return result;
  })
};