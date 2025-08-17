/**
 * Mock for citation-checker
 */

export const citationChecker = {
  validateCitationStyle: jest.fn().mockImplementation((document: any, paragraphs: any[]) => {
    return [
      {
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 15 } },
        message: 'テスト引用スタイル違反',
        severity: 'warn',
        ruleId: 'test-citation-rule'
      }
    ];
  }),
  
  createDiagnostics: jest.fn().mockImplementation((violations: any[]) => {
    return violations.map(v => ({
      range: v.range,
      message: v.message,
      severity: 2 // Warning
    }));
  }),
  
  initializeDefaultStyles: jest.fn().mockImplementation(() => {
    // Mock initialization
  }),
  
  setActiveStyle: jest.fn().mockImplementation((styleId: string) => {
    // Mock style setting
  })
};