import { extractWithFlashText } from '../features/flashtext-bridge';
import { Paragraph, ParagraphType } from '../core/types';

// Mock python-shell to avoid real Python execution
const runMock = jest.fn();
jest.mock('python-shell', () => ({
  PythonShell: {
    run: (...args: any[]) => runMock(...args)
  }
}));

describe('FlashText Bridge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns keywords map when python-shell returns results', async () => {
    // Arrange: mock PythonShell.run to call back with JSON array string
    const output = [
      JSON.stringify([
        { id: 'p1', matches: { keyword1: 2, TypeScript: 1 } },
        { id: 'p2', matches: {} }
      ])
    ];
    runMock.mockImplementation((_script: string, _opts: any, cb: Function) => cb(null, output));

    const paragraphs: Paragraph[] = [
      { id: 'p1', range: { start: 0, end: 20 }, text: 'keyword1 and TypeScript and keyword1', chars: 30, type: ParagraphType.Normal },
      { id: 'p2', range: { start: 21, end: 30 }, text: 'no keywords', chars: 10, type: ParagraphType.Normal }
    ];

    // Act
    const map = await extractWithFlashText(paragraphs);

    // Assert
    expect(map).toBeInstanceOf(Map);
    const p1 = map.get('p1') || [];
    const terms = p1.map(k => k.text);
    expect(terms).toEqual(expect.arrayContaining(['keyword1', 'TypeScript']));
    const freq = Object.fromEntries(p1.map(k => [k.text, k.frequency] as const));
    expect(freq['keyword1']).toBe(2);
    expect(freq['TypeScript']).toBe(1);

    const p2 = map.get('p2') || [];
    expect(p2.length).toBe(0);
  });

  test('returns empty map on python-shell error', async () => {
    runMock.mockImplementation((_script: string, _opts: any, cb: Function) => cb(new Error('boom'), undefined));

    const paragraphs: Paragraph[] = [
      { id: 'p1', range: { start: 0, end: 10 }, text: 'text', chars: 4, type: ParagraphType.Normal }
    ];

    const map = await extractWithFlashText(paragraphs);
    expect(map.size).toBe(0);
  });
});
