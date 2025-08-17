/**
 * Mock for style-checker
 */

// Mock dictionary state
let mockDictionary: any[] = [];

export const styleChecker = {
  loadDictionary: jest.fn().mockImplementation((entries: any[]) => {
    mockDictionary = entries || [];
    return Promise.resolve(true);
  }),
  
  checkStyle: jest.fn().mockImplementation((document: any, paragraphs: any[]) => {
    const violations: any[] = [];
    
    // If no dictionary loaded, return empty violations
    if (mockDictionary.length === 0) {
      return [];
    }
    
    // Check each paragraph for violations
    for (const paragraph of paragraphs) {
      const text = paragraph.text || '';
      
      // Skip empty paragraphs
      if (!text.trim()) {
        continue;
      }
      
      // Find all potential matches with their positions and lengths
      const potentialMatches: Array<{
        pattern: string;
        entry: any;
        start: number;
        end: number;
      }> = [];
      
      for (const entry of mockDictionary) {
        const pattern = entry.pattern;
        const index = text.indexOf(pattern);
        if (index !== -1) {
          potentialMatches.push({
            pattern: pattern,
            entry: entry,
            start: index,
            end: index + pattern.length
          });
        }
      }
      
      // Implement longest match priority - sort by length descending, then by position
      potentialMatches.sort((a, b) => {
        const lengthDiff = b.pattern.length - a.pattern.length;
        if (lengthDiff !== 0) return lengthDiff;
        return a.start - b.start;
      });
      
      // Filter out overlapping matches, keeping only the longest ones
      const finalMatches: typeof potentialMatches = [];
      for (const match of potentialMatches) {
        const hasOverlap = finalMatches.some(existing => 
          (match.start < existing.end && match.end > existing.start)
        );
        if (!hasOverlap) {
          finalMatches.push(match);
        }
      }
      
      // Create violations from final matches
      for (const match of finalMatches) {
        violations.push({
          range: { 
            start: { line: 0, character: match.start }, 
            end: { line: 0, character: match.end } 
          },
          message: `「${match.pattern}」は「${match.entry.suggestion || '適切な表現'}」に修正することを推奨します`,
          severity: match.entry.severity || 'warn',
          pattern: match.pattern,
          suggestion: match.entry.suggestion,
          note: match.entry.note,
          category: match.entry.category || 'style'
        });
      }
    }
    
    return violations;
  }),
  
  createDiagnostics: jest.fn().mockImplementation((violations: any[]) => {
    return violations.map(v => ({
      range: v.range,
      message: v.message,
      severity: typeof v.severity === 'number' ? v.severity : (v.severity === 'error' ? 0 : v.severity === 'warn' ? 1 : 2),
      source: 'CriticalWritingJp-Style',
      code: v.suggestion
    }));
  }),
  
  // Additional mock methods that might be needed
  loadDictionaryFromFile: jest.fn().mockImplementation(async (filePath: string) => {
    const extension = filePath.split('.').pop()?.toLowerCase();
    if (extension !== 'csv' && extension !== 'json') {
      throw new Error('Unsupported dictionary format');
    }
    return true;
  })
};