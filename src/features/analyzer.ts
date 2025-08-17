import * as vscode from 'vscode';
import { Paragraph, ParagraphType, AnalysisResult } from '../core/types';
import { normalizeText, countChars, sha1, debounce } from '../core/utils';
import { getSettings } from '../extension';

// デバウンス処理済みの解析関数
const debouncedAnalysis = debounce(performAnalysis, 150);

// 解析結果のキャッシュ（ドキュメントURIをキー）
const analysisCache = new Map<string, AnalysisResult>();

/**
 * テキスト変更イベントの処理
 * @param event テキスト変更イベント
 */
export async function handleTextChange(event: vscode.TextDocumentChangeEvent): Promise<void> {
  if (event.document.languageId !== 'markdown') {
    return;
  }

  // デバウンス処理で解析を遅延実行
  debouncedAnalysis(event.document);
}

/**
 * ドキュメント解析の実行
 * @param document 解析対象ドキュメント
 */
export async function runAnalysis(document: vscode.TextDocument): Promise<AnalysisResult | undefined> {
  try {
    const result = await performAnalysis(document);
    
    // エディタ装飾を更新
    await updateEditorDecorations(document, result);
    
    return result;
  } catch (error) {
    console.error('[Analyzer] Analysis failed:', error);
    return undefined;
  }
}

/**
 * 実際の解析処理
 * @param document 解析対象ドキュメント
 */
async function performAnalysis(document: vscode.TextDocument): Promise<AnalysisResult> {
  const startTime = Date.now();
  
  console.log(`[Analyzer] Starting analysis for ${document.uri.toString()}`);
  
  try {
    // 段落の検出と解析
    const paragraphs = detectParagraphs(document);
    
    // 解析結果を作成
    const result: AnalysisResult = {
      documentUri: document.uri.toString(),
      paragraphs,
      keywords: new Map(), // 将来実装
      scores: new Map(),   // 将来実装
      timestamp: Date.now()
    };
    
    // キャッシュに保存
    analysisCache.set(document.uri.toString(), result);
    
    const elapsedTime = Date.now() - startTime;
    console.log(`[Analyzer] Analysis completed in ${elapsedTime}ms (${paragraphs.length} paragraphs)`);
    
    return result;
  } catch (error) {
    const elapsedTime = Date.now() - startTime;
    console.error(`[Analyzer] Analysis failed after ${elapsedTime}ms:`, error);
    throw error;
  }
}

/**
 * Markdownドキュメントから段落を検出
 * @param document 対象ドキュメント
 * @returns 段落の配列
 */
function detectParagraphs(document: vscode.TextDocument): Paragraph[] {
  const text = document.getText();
  const lines = text.split('\n');
  const paragraphs: Paragraph[] = [];
  
  let currentParagraph: {
    lines: string[];
    startLine: number;
    startOffset: number;
    type: ParagraphType;
  } | null = null;
  
  let currentOffset = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    // 空行の処理
    if (trimmedLine === '') {
      if (currentParagraph) {
        // 現在の段落を終了
        finalizeParagraph(currentParagraph, currentOffset, paragraphs);
        currentParagraph = null;
      }
      currentOffset += line.length + 1; // +1 for \n
      continue;
    }
    
    // 段落の種類を判定
    const lineType = detectLineType(trimmedLine);
    
    if (currentParagraph) {
      if (currentParagraph.type === lineType || 
          (currentParagraph.type === ParagraphType.Normal && lineType === ParagraphType.Normal)) {
        // 同じ種類の段落に追加
        currentParagraph.lines.push(line);
      } else {
        // 種類が変わったので前の段落を終了し、新しい段落を開始
        finalizeParagraph(currentParagraph, currentOffset, paragraphs);
        currentParagraph = {
          lines: [line],
          startLine: i,
          startOffset: currentOffset,
          type: lineType
        };
      }
    } else {
      // 新しい段落を開始
      currentParagraph = {
        lines: [line],
        startLine: i,
        startOffset: currentOffset,
        type: lineType
      };
    }
    
    currentOffset += line.length + 1; // +1 for \n
  }
  
  // 最後の段落を処理
  if (currentParagraph) {
    finalizeParagraph(currentParagraph, currentOffset, paragraphs);
  }
  
  return paragraphs;
}

/**
 * 行の種類を判定
 * @param line 判定対象の行（トリム済み）
 * @returns 段落の種類
 */
function detectLineType(line: string): ParagraphType {
  // 見出し
  if (/^#{1,6}\s+/.test(line)) {
    return ParagraphType.Heading;
  }
  
  // リスト項目（番号付きリスト）
  if (/^\d+\.\s+/.test(line)) {
    return ParagraphType.ListItem;
  }
  
  // リスト項目（箇条書き）
  if (/^[-*+]\s+/.test(line)) {
    return ParagraphType.ListItem;
  }
  
  // 引用ブロック
  if (/^>\s*/.test(line)) {
    return ParagraphType.Quote;
  }
  
  // コードブロック
  if (/^```/.test(line) || /^    /.test(line)) {
    return ParagraphType.CodeBlock;
  }
  
  // 脚注
  if (/^\[\^[^\]]+\]:\s*/.test(line)) {
    return ParagraphType.Footnote;
  }
  
  return ParagraphType.Normal;
}

/**
 * 段落を確定してリストに追加
 */
function finalizeParagraph(
  currentParagraph: {
    lines: string[];
    startLine: number;
    startOffset: number;
    type: ParagraphType;
  },
  endOffset: number,
  paragraphs: Paragraph[]
): void {
  const text = currentParagraph.lines.join('\n');
  const normalizedText = normalizeText(text);
  const chars = countChars(text);
  const id = sha1(normalizedText);
  
  // 実際の終了オフセットを計算（最後の改行を除く）
  const actualEndOffset = endOffset - 1;
  
  const paragraph: Paragraph = {
    id,
    range: {
      start: currentParagraph.startOffset,
      end: actualEndOffset
    },
    text,
    chars,
    type: currentParagraph.type,
    features: calculateFeatures(text, currentParagraph.type)
  };
  
  paragraphs.push(paragraph);
}

/**
 * 段落の特徴量を計算
 * @param text 段落テキスト
 * @param type 段落種類
 * @returns 特徴量オブジェクト
 */
function calculateFeatures(text: string, type: ParagraphType): Record<string, number> {
  const features: Record<string, number> = {};
  
  // 基本的な特徴量
  features.length = text.length;
  features.wordCount = text.split(/\s+/).length;
  features.sentenceCount = text.split(/[。！？]/).length;
  
  // 句読点の頻度
  features.punctuationRatio = (text.match(/[、。]/g) || []).length / text.length;
  
  // 引用らしき記述の検出
  features.citationCount = (text.match(/【[^】]+】/g) || []).length + 
                          (text.match(/\([^)]+\d{4}[^)]*\)/g) || []).length;
  
  // ディスコースマーカーの検出
  const discourseMarkers = ['しかし', 'したがって', 'また', 'さらに', 'つまり', 'なぜなら'];
  features.discourseMarkerCount = discourseMarkers.reduce((count, marker) => {
    return count + (text.split(marker).length - 1);
  }, 0);
  
  // 段落種類による重み
  switch (type) {
    case ParagraphType.Heading:
      features.typeWeight = 1.2;
      break;
    case ParagraphType.Quote:
      features.typeWeight = 0.8;
      break;
    case ParagraphType.CodeBlock:
      features.typeWeight = 0.3;
      break;
    default:
      features.typeWeight = 1.0;
      break;
  }
  
  return features;
}

/**
 * エディタの装飾を更新
 * @param document 対象ドキュメント
 * @param result 解析結果
 */
async function updateEditorDecorations(
  document: vscode.TextDocument, 
  result: AnalysisResult
): Promise<void> {
  const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
  if (!editor) {
    return;
  }
  
  const settings = getSettings();
  const { min, max } = settings.counting.threshold;
  
  // 装飾タイプを作成（初回のみ）
  const overDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    border: '1px solid rgba(255, 0, 0, 0.3)',
    borderRadius: '3px'
  });
  
  const underDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 165, 0, 0.1)',
    border: '1px solid rgba(255, 165, 0, 0.3)',
    borderRadius: '3px'
  });
  
  const overRanges: vscode.Range[] = [];
  const underRanges: vscode.Range[] = [];
  
  // 各段落の文字数をチェック
  for (const paragraph of result.paragraphs) {
    if (paragraph.type === ParagraphType.CodeBlock || paragraph.type === ParagraphType.Quote) {
      // コードブロックや引用は装飾対象外
      continue;
    }
    
    const startPos = document.positionAt(paragraph.range.start);
    const endPos = document.positionAt(paragraph.range.end);
    const range = new vscode.Range(startPos, endPos);
    
    if (paragraph.chars > max) {
      overRanges.push(range);
    } else if (paragraph.chars < min) {
      underRanges.push(range);
    }
  }
  
  // 装飾を適用
  editor.setDecorations(overDecoration, overRanges);
  editor.setDecorations(underDecoration, underRanges);
  
  // ステータスバーの更新
  updateStatusBar(result, settings);
}

/**
 * ステータスバーの更新
 */
function updateStatusBar(result: AnalysisResult, settings: any): void {
  const { min, max } = settings.counting.threshold;
  const overCount = result.paragraphs.filter(p => p.chars > max).length;
  const underCount = result.paragraphs.filter(p => p.chars < min).length;
  const totalChars = result.paragraphs.reduce((sum, p) => sum + p.chars, 0);
  
  let statusText = `段落:${result.paragraphs.length} 文字:${totalChars}`;
  if (overCount > 0 || underCount > 0) {
    statusText += ` 超過:${overCount} 不足:${underCount}`;
  }
  
  // ステータスバーアイテムの作成（グローバルに保持する必要がある）
  const globalAny = global as any;
  if (!globalAny.criticalWritingStatusBar) {
    globalAny.criticalWritingStatusBar = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right, 100
    );
  }
  
  globalAny.criticalWritingStatusBar.text = `📝 ${statusText}`;
  globalAny.criticalWritingStatusBar.show();
}

/**
 * キャッシュされた解析結果を取得
 * @param documentUri ドキュメントURI
 * @returns 解析結果（存在しない場合はundefined）
 */
export function getCachedAnalysisResult(documentUri: string): AnalysisResult | undefined {
  return analysisCache.get(documentUri);
}