import { keywordEngine } from '../features/keyword-engine';
import { extractWithFlashText } from '../features/flashtext-bridge';
import { Paragraph, ParagraphType, Keyword } from '../core/types';

jest.mock('../features/flashtext-bridge');

describe('KeywordEngine', () => {
  const mockExtractWithFlashText = extractWithFlashText as jest.Mock;

  beforeEach(() => {
    mockExtractWithFlashText.mockClear();
  });

  it('should call extractWithFlashText with paragraphs', async () => {
    const paragraphs: Paragraph[] = [
      {
        id: 'test1',
        range: { start: 0, end: 50 },
        text: 'This is a test paragraph.',
        chars: 25,
        type: ParagraphType.Normal,
        features: {},
      },
    ];

    const mockKeywords = new Map<string, Keyword[]>();
    mockKeywords.set('test1', [{ text: 'test', score: 1, frequency: 1, partOfSpeech: 'NN' }]);
    mockExtractWithFlashText.mockResolvedValue(mockKeywords);

    const result = await keywordEngine.extractKeywords(paragraphs);

    expect(mockExtractWithFlashText).toHaveBeenCalledTimes(1);
    expect(mockExtractWithFlashText).toHaveBeenCalledWith(paragraphs, undefined);
    expect(result).toEqual(mockKeywords);
  });

  it('should handle empty paragraphs array', async () => {
    const paragraphs: Paragraph[] = [];
    mockExtractWithFlashText.mockResolvedValue(new Map());

    await keywordEngine.extractKeywords(paragraphs);

    expect(mockExtractWithFlashText).toHaveBeenCalledTimes(1);
    expect(mockExtractWithFlashText).toHaveBeenCalledWith([], undefined);
  });

  it('should return an empty map if the bridge throws an error', async () => {
    const paragraphs: Paragraph[] = [{
      id: 'test1',
      range: { start: 0, end: 10 },
      text: 'error case',
      chars: 10,
      type: ParagraphType.Normal,
      features: {},
    }];

    const testError = new Error('FlashText failed');
    mockExtractWithFlashText.mockRejectedValue(testError);

    const result = await keywordEngine.extractKeywords(paragraphs);

    expect(mockExtractWithFlashText).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });
});
