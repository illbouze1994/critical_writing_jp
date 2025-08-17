/**
 * Mock for citation-checker
 */

// Mock style pack state
let mockStylePacks: Map<string, any> = new Map();
let activeStyleId: string = '';

export const citationChecker = {
  loadStylePack: jest.fn().mockImplementation((stylePack: any) => {
    mockStylePacks.set(stylePack.styleId, stylePack);
  }),
  
  setActiveStyle: jest.fn().mockImplementation((styleId: string) => {
    if (!mockStylePacks.has(styleId)) {
      throw new Error(`Style pack not found: ${styleId}`);
    }
    activeStyleId = styleId;
  }),
  
  validateCitationStyle: jest.fn().mockImplementation((document: any, paragraphs: any[]) => {
    const violations: any[] = [];
    
    // Only validate if we have an active style
    if (!activeStyleId || !mockStylePacks.has(activeStyleId)) {
      return [];
    }
    
    const activePack = mockStylePacks.get(activeStyleId);
    if (!activePack || !activePack.rules) {
      return [];
    }
    
    // Check each paragraph for citation violations
    for (const paragraph of paragraphs) {
      const text = paragraph.text || '';
      if (!text.trim()) continue;
      
      // Check each rule in the active style pack
      for (const rule of activePack.rules) {
        if (rule.target !== 'intext') continue;
        
        // Use a broader regex to catch all potential citation formats
        const broadCitationRegex = /（[^）]*）/g;
        const broadMatches = text.matchAll(broadCitationRegex);
        
        for (const match of broadMatches) {
          const matchText = match[0];
          
          // Extract tokens for validation
          let tokens: any[] = [];
          if (matchText.includes('（') && matchText.includes('）')) {
            // Author-year format like （山田 2020）
            const content = matchText.replace(/[（）]/g, '');
            
            // Handle different splitting patterns
            let parts: string[];
            if (content.includes(' ')) {
              // For space-separated content, preserve the original split to detect empty authors
              const originalParts = content.split(/\s+/);
              if (originalParts.length >= 2) {
                // Keep original parts but trim them
                parts = [originalParts[0].trim(), originalParts[1].trim()];
              } else {
                parts = [content.trim()];
              }
            } else {
              // Try to split author and year for patterns like "田中20"
              const yearMatch = content.match(/(\d+)$/);
              if (yearMatch) {
                const yearPart = yearMatch[0];
                const authorPart = content.replace(yearPart, '').trim();
                parts = [authorPart, yearPart];
              } else {
                parts = [content.trim()];
              }
            }
            
            if (parts.length >= 2) {
              const authorText = (parts[0] || '').trim();
              const yearText = (parts[1] || '').trim();
              
              tokens.push({ kind: 'author', text: authorText });
              
              // Only create a year token if it's a valid 4-digit year
              if (/^\d{4}$/.test(yearText)) {
                tokens.push({ kind: 'year', text: yearText });
              }
            } else if (parts.length === 1) {
              tokens.push({ kind: 'author', text: (parts[0] || '').trim() });
            }
          } else {
            tokens.push({ kind: 'others', text: matchText });
          }
          
          // Run validation
          const validation = rule.validate(tokens);
          if (!validation.ok) {
            const correctedText = rule.format(tokens);
            violations.push({
              range: {
                start: { line: 0, character: match.index || 0 },
                end: { line: 0, character: (match.index || 0) + matchText.length }
              },
              originalText: matchText,
              correctedText: correctedText,
              message: `引用形式が不正です: ${validation.issues.join(', ')}`,
              severity: rule.severity || 'warn',
              ruleId: rule.id,
              issues: validation.issues
            });
          }
        }
      }
    }
    
    return violations;
  }),
  
  createDiagnostics: jest.fn().mockImplementation((violations: any[]) => {
    return violations.map(v => ({
      range: v.range,
      message: v.message,
      severity: typeof v.severity === 'number' ? v.severity : (v.severity === 'error' ? 0 : v.severity === 'warn' ? 1 : 2),
      source: 'CriticalWritingJp-Citation',
      code: v.correctedText || v.suggestion
    }));
  }),
  
  initializeDefaultStyles: jest.fn().mockImplementation(() => {
    // Initialize default style pack
    const defaultStylePack = {
      styleId: 'generic.ja.v1',
      displayName: '汎用日本語スタイル v1',
      locale: 'ja',
      rules: []
    };
    mockStylePacks.set('generic.ja.v1', defaultStylePack);
  }),
  
  loadStylePackFromFile: jest.fn().mockImplementation(async (filePath: string) => {
    try {
      // Get the mocked file content
      const fs = require('fs');
      const content = await fs.promises.readFile(filePath, 'utf8');
      
      // Parse JSON content
      let stylePack;
      try {
        stylePack = JSON.parse(content);
      } catch (parseError) {
        throw new Error('Invalid JSON format');
      }
      
      // Validate required fields
      if (!stylePack.styleId || !stylePack.displayName) {
        throw new Error('Invalid style pack format');
      }
      
      // Load the style pack
      mockStylePacks.set(stylePack.styleId, stylePack);
      
      return true;
    } catch (error) {
      // Re-throw the error to be caught by the test
      throw error;
    }
  }),
  
  // Mock token extraction methods
  extractCitationTokens: jest.fn().mockImplementation((text: string) => {
    return [{ kind: 'others', text: text }];
  }),
  
  extractReferenceTokens: jest.fn().mockImplementation((text: string) => {
    return [{ kind: 'others', text: text }];
  })
};