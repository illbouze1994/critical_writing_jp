import * as vscode from 'vscode';
import { DisposableStore } from '../platform/disposable-store';
import { Paragraph, ParagraphType, AnalysisResult } from '../core/types';
import { normalizeText, countChars, sha1, debounce } from '../core/utils';
import { WebviewPanel } from '../features/webview-panel';
import { keywordEngine } from './keyword-engine';
import { isJoyo } from 'joyo-kanji';
import { roiEngine } from './roi-engine';
import { styleChecker } from './style-checker';
import { citationChecker } from './citation-checker';

// デバウンス処理済みの解析関数
const debouncedAnalysis = debounce(performAnalysis, 150);

// 解析結果のキャッシュ（ドキュメントURIをキー）
const analysisCache = new Map<string, AnalysisResult>();
let lastAnalyzedUri: string | undefined;

// 診断情報コレクション
let diagnosticCollection: vscode.DiagnosticCollection;
// ステータスバーアイテム
let statusBarItem: vscode.StatusBarItem | undefined;
// 拡張機能本体から渡されるDisposableStore
let analyzerDisposables: DisposableStore | undefined;
// 拡張機能のコンテキスト
let extensionContext: vscode.ExtensionContext;

/**
 * テキスト変更イベントの処理
 * @param event テキスト変更イベント
 */
export async function handleTextChange(event: vscode.TextDocumentChangeEvent): Promise<void> {
  const lang = event.document.languageId;
  if (lang !== 'markdown' && lang !== 'plaintext') {
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

function calculateOverallStats(paragraphs: Paragraph[]) {
  const allText = paragraphs.map(p => p.text).join('');
  const totalChars = allText.length;

  let hiragana = 0;
  let katakana = 0;
  let kanji = 0;
  let other = 0;
  let joyo = 0;
  let nonJoyo = 0;

  for (const char of allText) {
    if (char.match(/[\u3040-\u309F]/)) {
      hiragana++;
    } else if (char.match(/[\u30A0-\u30FF]/)) {
      katakana++;
    } else if (char.match(/[\u4E00-\u9FAF]/)) {
      kanji++;
      if (isJoyo(char)) {
        joyo++;
      } else {
        nonJoyo++;
      }
    } else {
      other++;
    }
  }

  const charBalance = [
    { name: 'ひらがな', value: hiragana / totalChars },
    { name: 'カタカナ', value: katakana / totalChars },
    { name: '漢字', value: kanji / totalChars },
    { name: 'その他', value: other / totalChars },
  ];

  const joyoKanji = [
    { name: '常用漢字', value: joyo / (joyo + nonJoyo || 1) },
    { name: '常用外漢字', value: nonJoyo / (joyo + nonJoyo || 1) },
  ];

  return {
    summary: {
      chars: totalChars,
    },
    charts: {
      charBalance,
      joyoKanji,
    }
  };
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
    
    // 設定を取得
    const config = vscode.workspace.getConfiguration('criticalWritingJp');
    const roiWeights = config.get('roi.weights', { w1: 0.35, w2: 0.35, w3: 0.15, w4: 0.15 });
    
    // Keyword extraction should always run as it's used for ROI scores, not just highlighting.
    console.log(`[Analyzer] Extracting keywords (mode: flashtext)`);
    const keywords = await keywordEngine.extractKeywords(paragraphs);
    
    // ROIスコア計算
    console.log(`[Analyzer] Calculating ROI scores`);
    const scores = roiEngine.calculateROI(paragraphs, keywords, roiWeights);
    
    // スタイルチェック（辞書が読み込まれている場合のみ）
    console.log(`[Analyzer] Checking style violations`);
    const styleViolations = styleChecker.checkStyle(document, paragraphs);
    
    // 引用スタイルチェック
    console.log(`[Analyzer] Validating citation style`);
    const citationViolations = citationChecker.validateCitationStyle(document, paragraphs);
    
    // 解析結果を作成
    const result: AnalysisResult = {
      documentUri: document.uri.toString(),
      paragraphs,
      keywords,
      scores,
      timestamp: Date.now()
    };
    
    // キャッシュに保存
    analysisCache.set(document.uri.toString(), result);
    lastAnalyzedUri = document.uri.toString();
    
    const elapsedTime = Date.now() - startTime;
    console.log(`[Analyzer] Analysis completed in ${elapsedTime}ms (${paragraphs.length} paragraphs, ${keywords.size} keyword sets, ${scores.size} scores)`);
    
    // 診断情報を更新
    updateDiagnostics(document, styleViolations, citationViolations);
    
    // Webviewパネルに解析結果を送信
    if (extensionContext) {
      const overallStats = calculateOverallStats(result.paragraphs);
      const panel = WebviewPanel.getInstance(extensionContext);
      const panelUpdateData = {
        paragraphs: result.paragraphs,
        statistics: {
          totalCount: result.paragraphs.length,
          chars: overallStats.summary.chars,
        },
        charts: overallStats.charts,
        },
      };
      // updateWithAnalysisResult は ParagraphAnalysisResult 型を期待するが、
      // 構造が互換なのでそのまま渡す
      panel.updateWithAnalysisResult(panelUpdateData as any);
    }

    return result;
  } catch (error) {
    const elapsedTime = Date.now() - startTime;
    console.error(`[Analyzer] Analysis failed after ${elapsedTime}ms:`, error);
    throw error;
  }
}

/**
 * ドキュメントから段落を検出するディスパッチャ
 * @param document 対象ドキュメント
 * @returns 段落の配列
 */
function detectParagraphs(document: vscode.TextDocument): Paragraph[] {
  if (document.languageId === 'plaintext') {
    return detectPlaintextParagraphs(document);
  }
  // Default to markdown for now
  return detectMarkdownParagraphs(document);
}

/**
 * Plaintextドキュメントから段落を検出
 * @param document 対象ドキュメント
 * @returns 段落の配列
 */
function detectPlaintextParagraphs(document: vscode.TextDocument): Paragraph[] {
  const text = document.getText();
  const lines = text.split('\n');
  const paragraphs: Paragraph[] = [];
  let currentParagraphLines: string[] = [];
  let paragraphStartOffset = 0;
  let currentOffset = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith(' ')) { // New paragraph starts with a single-byte space
      if (currentParagraphLines.length > 0) {
        // Finalize the previous paragraph
        const paragraphData = {
          lines: currentParagraphLines,
          startOffset: paragraphStartOffset,
          type: ParagraphType.Normal
        };
        finalizeParagraph(paragraphData, currentOffset, paragraphs);
      }
      // Start a new paragraph
      currentParagraphLines = [line.substring(1)]; // Remove the leading space
      paragraphStartOffset = currentOffset + 1;
    } else if (line.trim() !== '' && currentParagraphLines.length > 0) {
      // This line belongs to the current paragraph
      currentParagraphLines.push(line);
    } else {
      // This is not part of a paragraph (e.g. empty line between paragraphs)
      if (currentParagraphLines.length > 0) {
        const paragraphData = {
          lines: currentParagraphLines,
          startOffset: paragraphStartOffset,
          type: ParagraphType.Normal
        };
        finalizeParagraph(paragraphData, currentOffset, paragraphs);
        currentParagraphLines = [];
      }
    }
    currentOffset += line.length + 1;
  }

  // Finalize the last paragraph if it exists
  if (currentParagraphLines.length > 0) {
    const paragraphData = {
      lines: currentParagraphLines,
      startOffset: paragraphStartOffset,
      type: ParagraphType.Normal,
    };
    finalizeParagraph(paragraphData, currentOffset, paragraphs);
  }

  return paragraphs;
}

/**
 * Markdownドキュメントから段落を検出
 * @param document 対象ドキュメント
 * @returns 段落の配列
 */
function detectMarkdownParagraphs(document: vscode.TextDocument): Paragraph[] {
  const text = document.getText();
  const lines = text.split('\n');
  const paragraphs: Paragraph[] = [];
  
  let currentOffset = 0;
  let currentSection: {
    headerLine?: string;
    contentLines: string[];
    startOffset: number;
    startLineIndex: number;
  } | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    // ヘッダー行の検出（#で始まる行）
    if (/^#{1,6}\s+/.test(trimmedLine)) {
      // 前のセクションがあれば処理
      if (currentSection) {
        processSectionContent(currentSection, paragraphs);
      }
      
      // 新しいセクションの開始
      currentSection = {
        headerLine: line,
        contentLines: [],
        startOffset: currentOffset,
        startLineIndex: i
      };
    } else if (currentSection) {
      // ヘッダーの下のコンテンツ行を収集
      currentSection.contentLines.push(line);
    } else if (trimmedLine !== '') {
      // ヘッダーなしのコンテンツ（ドキュメント冒頭など）
      const lineType = detectLineType(trimmedLine);
      const paragraphData = {
        lines: [line],
        startLine: i,
        startOffset: currentOffset,
        type: lineType
      };
      finalizeParagraph(paragraphData, currentOffset + line.length + 1, paragraphs);
    }
    
    currentOffset += line.length + 1; // +1 for \n
  }
  
  // 最後のセクションを処理
  if (currentSection) {
    processSectionContent(currentSection, paragraphs);
  }
  
  return paragraphs;
}

/**
 * セクション（ヘッダー配下）のコンテンツを段落に分割
 */
function processSectionContent(
  section: {
    headerLine?: string;
    contentLines: string[];
    startOffset: number;
    startLineIndex: number;
  },
  paragraphs: Paragraph[]
): void {
  const contentLines = section.contentLines;
  let currentParagraph: string[] = [];
  let paragraphStartOffset = section.startOffset;
  
  // ヘッダー行の分だけオフセットを進める
  if (section.headerLine) {
    paragraphStartOffset += section.headerLine.length + 1;
  }
  
  for (let i = 0; i < contentLines.length; i++) {
    const line = contentLines[i];
    const trimmedLine = line.trim();
    
    if (trimmedLine === '') {
      // 空行で段落を区切る
      if (currentParagraph.length > 0) {
        createTextParagraph(currentParagraph, paragraphStartOffset, paragraphs);
        currentParagraph = [];
        
        // 次の段落の開始オフセットを更新
        paragraphStartOffset += currentParagraph.reduce((sum, l) => sum + l.length + 1, 0) + line.length + 1;
      } else {
        paragraphStartOffset += line.length + 1;
      }
    } else {
      // 特殊な行タイプの場合は独立した段落として扱う
      const lineType = detectLineType(trimmedLine);
      if (lineType !== ParagraphType.Normal) {
        // 現在の通常段落があれば先に確定
        if (currentParagraph.length > 0) {
          createTextParagraph(currentParagraph, paragraphStartOffset, paragraphs);
          currentParagraph = [];
        }
        
        // 特殊行を独立段落として作成
        const paragraphData = {
          lines: [line],
          startLine: section.startLineIndex + i + 1, // +1 for header
          startOffset: paragraphStartOffset,
          type: lineType
        };
        finalizeParagraph(paragraphData, paragraphStartOffset + line.length + 1, paragraphs);
        paragraphStartOffset += line.length + 1;
      } else {
        // 通常のテキスト行は現在の段落に追加
        currentParagraph.push(line);
      }
    }
  }
  
  // 最後の段落を処理
  if (currentParagraph.length > 0) {
    createTextParagraph(currentParagraph, paragraphStartOffset, paragraphs);
  }
}

/**
 * テキスト段落を作成（日本語の場合、全角スペースで始まる行を段落区切りとして扱う）
 */
function createTextParagraph(lines: string[], startOffset: number, paragraphs: Paragraph[]): void {
  if (lines.length === 0) return;
  
  // 日本語文書の場合、全角スペース（　）で始まる行ごとに段落を分割
  const subParagraphs: string[][] = [];
  let currentSubParagraph: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('　') || trimmed.match(/^[^\s　]/)) {
      // 全角スペースで始まる行、または通常の文字で始まる行
      if (currentSubParagraph.length > 0 && trimmed.startsWith('　')) {
        // 新しい段落の開始
        subParagraphs.push([...currentSubParagraph]);
        currentSubParagraph = [line];
      } else {
        currentSubParagraph.push(line);
      }
    } else {
      currentSubParagraph.push(line);
    }
  }
  
  // 最後のサブ段落を追加
  if (currentSubParagraph.length > 0) {
    subParagraphs.push(currentSubParagraph);
  }
  
  // 各サブ段落をParagraphオブジェクトとして作成
  let currentOffset = startOffset;
  for (const subLines of subParagraphs) {
    const paragraphData = {
      lines: subLines,
      startLine: 0, // 実際の行番号計算は省略（必要に応じて実装）
      startOffset: currentOffset,
      type: ParagraphType.Normal
    };
    
    const endOffset = currentOffset + subLines.reduce((sum, line) => sum + line.length + 1, 0);
    finalizeParagraph(paragraphData, endOffset, paragraphs);
    currentOffset = endOffset;
  }
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
  
  // キーワード抽出（簡易実装：重要そうな単語をカウント）
  const importantKeywords = ['重要', '必要', '問題', '解決', '分析', '研究', '結果', '効果', '影響', '方法', '技術', '開発', 'システム', 'データ', '情報'];
  features.keywordCount = importantKeywords.reduce((count, keyword) => {
    return count + (text.split(keyword).length - 1);
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
// 永続的な装飾タイプ（再解析時の重複作成を防止）
let overDecorationType: vscode.TextEditorDecorationType | undefined;
let underDecorationType: vscode.TextEditorDecorationType | undefined;
let keywordDecorationType: vscode.TextEditorDecorationType | undefined;
let charCountDecorationType: vscode.TextEditorDecorationType | undefined;

async function updateEditorDecorations(
  document: vscode.TextDocument, 
  result: AnalysisResult
): Promise<void> {
  const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
  if (!editor) {
    return;
  }
  
  const config = vscode.workspace.getConfiguration('criticalWritingJp');
  const settings = {
    counting: {
      threshold: {
        min: config.get<number>('counting.threshold.min', 200),
        max: config.get<number>('counting.threshold.max', 800)
      }
    }
  };
  const { min, max } = settings.counting.threshold;
  
  // 装飾タイプを作成（初回のみ）
  if (!overDecorationType) {
    overDecorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(255, 0, 0, 0.1)',
      border: '1px solid rgba(255, 0, 0, 0.3)',
      borderRadius: '3px'
    });
    analyzerDisposables?.add(overDecorationType);
  }
  if (!underDecorationType) {
    underDecorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(255, 165, 0, 0.1)',
      border: '1px solid rgba(255, 165, 0, 0.3)',
      borderRadius: '3px'
    });
    analyzerDisposables?.add(underDecorationType);
  }
  if (!keywordDecorationType) {
    keywordDecorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(0, 255, 255, 0.15)',
      border: '1px solid rgba(0, 255, 255, 0.4)',
      borderRadius: '2px',
      fontWeight: 'bold'
    });
    analyzerDisposables?.add(keywordDecorationType);
  }
  
  const overRanges: vscode.Range[] = [];
  const underRanges: vscode.Range[] = [];
  const keywordRanges: vscode.Range[] = [];
  
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
    
    // キーワードのハイライト処理
    const paragraphKeywords = result.keywords.get(paragraph.id);
    if (paragraphKeywords && paragraphKeywords.length > 0) {
      const paragraphText = paragraph.text;
      const startOffset = paragraph.range.start;
      
      for (const keyword of paragraphKeywords) {
        let searchStart = 0;
        let index = -1;
        
        // 同じキーワードの複数出現をすべて検出
        while ((index = paragraphText.indexOf(keyword.text, searchStart)) !== -1) {
          const keywordStartPos = document.positionAt(startOffset + index);
          const keywordEndPos = document.positionAt(startOffset + index + keyword.text.length);
          const keywordRange = new vscode.Range(keywordStartPos, keywordEndPos);
          keywordRanges.push(keywordRange);
          searchStart = index + 1;
        }
      }
    }
  }
  
  // 装飾を適用
  if (overDecorationType) editor.setDecorations(overDecorationType, overRanges);
  if (underDecorationType) editor.setDecorations(underDecorationType, underRanges);
  if (keywordDecorationType) editor.setDecorations(keywordDecorationType, keywordRanges);

  // 文字数カウントの装飾（初回のみ作成）
  if (!charCountDecorationType) {
    charCountDecorationType = vscode.window.createTextEditorDecorationType({
      after: {
        margin: '0 0 0 1em',
        color: new vscode.ThemeColor('editorCodeLens.foreground'),
        fontStyle: 'italic',
      },
      before: {
        margin: '0 1em 0 0',
        color: new vscode.ThemeColor('editorCodeLens.foreground'),
        fontStyle: 'italic',
      },
      rangeBehavior: (vscode as any).DecorationRangeBehavior ? (vscode as any).DecorationRangeBehavior.ClosedOpen : undefined,
    });
    analyzerDisposables?.add(charCountDecorationType);
  }

  const charCountRanges = result.paragraphs.map((p, index) => {
    const startPos = document.positionAt(p.range.start);
    const endPos = document.positionAt(p.range.end);
    return {
      range: new vscode.Range(startPos, endPos),
      renderOptions: {
        before: {
          contentText: `${p.chars}`,
          fontSize: '10pt',
        },
        after: {
          contentText: ``,
        },
      },
      // Only show hover message on the first paragraph to avoid duplication
      hoverMessage: index === 0 ? 'クリックしてパネルを開く' : undefined,
    };
  });

  // Attach command to decorations
  const charCountRangesWithCommand = charCountRanges.map(d => ({
    ...d,
    command: {
      command: 'criticalWritingJp.jumpToParagraphAndShowPanel',
      title: 'パネルを開く',
      arguments: [d.range],
    },
  }));

  if (charCountDecorationType) {
    editor.setDecorations(charCountDecorationType, charCountRangesWithCommand as vscode.DecorationOptions[]);
  }
  
  // ステータスバーの更新
  updateStatusBar(result, settings);
}

/**
 * ステータスバーの更新
 */
function updateStatusBar(result: AnalysisResult, settings: any): void {
  if (!analyzerDisposables) return;

  const { min, max } = settings.counting.threshold;
  const overCount = result.paragraphs.filter(p => p.chars > max).length;
  const underCount = result.paragraphs.filter(p => p.chars < min).length;
  const totalChars = result.paragraphs.reduce((sum, p) => sum + p.chars, 0);
  
  let statusText = `段落:${result.paragraphs.length} 文字:${totalChars}`;
  if (overCount > 0 || underCount > 0) {
    statusText += ` 超過:${overCount} 不足:${underCount}`;
  }
  
  // ステータスバーアイテムの作成（初回のみ）
  if (!statusBarItem) {
    statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right, 100
    );
    // DisposableStoreに登録して、拡張機能非アクティブ化時に破棄されるようにする
    analyzerDisposables.add(statusBarItem);
  }
  
  statusBarItem.text = `📝 ${statusText}`;
  statusBarItem.show();
}

/**
 * キャッシュされた解析結果を取得
 * @param documentUri ドキュメントURI
 * @returns 解析結果（存在しない場合はundefined）
 */
export function getCachedAnalysisResult(documentUri: string): AnalysisResult | undefined {
  return analysisCache.get(documentUri);
}

/**
 * 最後に解析されたドキュメントURIを取得
 */
export function getLastAnalyzedUri(): string | undefined {
  return lastAnalyzedUri;
}

/**
 * 指定URIの解析キャッシュをクリア
 * @param documentUri クリア対象のドキュメントURI
 */
export function clearAnalysisCache(documentUri: string): void {
  analysisCache.delete(documentUri);
  
  // 削除されたドキュメントが最後に解析されたものの場合、リセット
  if (lastAnalyzedUri === documentUri) {
    lastAnalyzedUri = undefined;
  }
  
  console.log(`[Analyzer] Cleared analysis cache for: ${documentUri}`);
}

/**
 * 指定URIのドキュメントを開いて解析を実行
 */
export async function runAnalysisForUri(uriString: string): Promise<AnalysisResult | undefined> {
  try {
    const uri = vscode.Uri.parse(uriString);
    const doc = await vscode.workspace.openTextDocument(uri);
    return await runAnalysis(doc);
  } catch (e) {
    console.warn('[Analyzer] Failed to run analysis for URI:', uriString, e);
    return undefined;
  }
}

/**
 * アナライザーの初期化
 * @param context 拡張機能コンテキスト
 * @param disposables 拡張機能全体のDisposableStore
 */
export async function initializeAnalyzer(
  context: vscode.ExtensionContext,
  disposables: DisposableStore
): Promise<void> {
  extensionContext = context;
  analyzerDisposables = disposables;
  try {
    // 診断情報コレクションを作成
    diagnosticCollection = vscode.languages.createDiagnosticCollection('criticalWritingJp');
    analyzerDisposables.add(diagnosticCollection);

    // キーワードエンジンの初期化（コンテキストを渡す）
    try {
      keywordEngine.initialize(context);
      console.log('[Analyzer] Keyword engine context set');
    } catch (error) {
      console.warn('[Analyzer] Failed to set keyword engine context:', error);
    }

    // 引用チェッカーのデフォルトスタイルを初期化
    try {
      citationChecker.initializeDefaultStyles();
      console.log('[Analyzer] Citation checker initialized');
    } catch (error) {
      console.warn('[Analyzer] Failed to initialize citation checker:', error);
    }

    console.log('[Analyzer] Initialized with diagnostic collection');
  } catch (error) {
    console.error('[Analyzer] Critical error during initialization:', error);
    throw error; // 重要なエラーのみ再スロー
  }
}

/**
 * アナライザーのリソースを破棄
 */
export function disposeAnalyzer(): void {
  // DisposableStoreによって自動的に破棄されるため、ここでは何もしない
  statusBarItem = undefined;
  analyzerDisposables = undefined;
  console.log('[Analyzer] Disposed analyzer resources.');
}

/**
 * 診断情報を更新
 * @param document 対象ドキュメント
 * @param styleViolations スタイル違反
 * @param citationViolations 引用違反
 */
function updateDiagnostics(
  document: vscode.TextDocument,
  styleViolations: any[],
  citationViolations: any[]
): void {
  if (!diagnosticCollection) {
    return;
  }

  const diagnostics: vscode.Diagnostic[] = [];

  // スタイル違反の診断情報を追加
  const styleDiagnostics = styleChecker.createDiagnostics(styleViolations);
  diagnostics.push(...styleDiagnostics);

  // 引用違反の診断情報を追加
  const citationDiagnostics = citationChecker.createDiagnostics(citationViolations);
  diagnostics.push(...citationDiagnostics);

  // 診断情報を設定
  diagnosticCollection.set(document.uri, diagnostics);

  console.log(`[Analyzer] Updated diagnostics: ${diagnostics.length} issues found`);
}