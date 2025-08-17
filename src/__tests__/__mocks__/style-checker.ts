/**
 * Mock for style-checker
 */

export const styleChecker = {
  checkStyle: jest.fn().mockImplementation((document: any, paragraphs: any[]) => {
    return [
      {
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
        message: 'テストスタイル違反',
        severity: 'warn',
        category: 'style'
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
  
  loadDictionary: jest.fn().mockResolvedValue(true)
};