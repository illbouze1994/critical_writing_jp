/**
 * 段落情報を表すインタフェース
 */
export interface Paragraph {
  /** 段落ID（内容のハッシュ値） */
  id: string;
  
  /** ドキュメント内の範囲 */
  range: {
    /** 開始オフセット（0-based） */
    start: number;
    /** 終了オフセット（0-based） */
    end: number;
  };
  
  /** 段落のテキスト内容 */
  text: string;
  
  /** 文字数（正規化後） */
  chars: number;
  
  /** 段落の種類 */
  type: ParagraphType;
  
  /** 特徴量（ROI計算用など） */
  features?: Record<string, number>;
}

/**
 * 段落の種類
 */
export enum ParagraphType {
  /** 通常の段落 */
  Normal = 'normal',
  
  /** 見出し */
  Heading = 'heading',
  
  /** リスト項目 */
  ListItem = 'listItem',
  
  /** 引用ブロック */
  Quote = 'quote',
  
  /** コードブロック */
  CodeBlock = 'codeBlock',
  
  /** 脚注 */
  Footnote = 'footnote'
}

/**
 * スコア情報を表すインタフェース
 */
export interface Scores {
  /** ROI重要度スコア */
  roi?: number;
  
  /** スタイルスコア */
  style?: number;
  
  /** 論証スコア */
  argumentation?: number;
  
  /** 語彙密度 */
  lexicalDensity?: number;
  
  /** 引用密度 */
  citationDensity?: number;
  
  /** 各スコアの内訳説明 */
  explain?: Record<string, number>;
}

/**
 * キーワード情報
 */
export interface Keyword {
  /** キーワードテキスト */
  text: string;
  
  /** 重要度スコア */
  score: number;
  
  /** 出現回数 */
  frequency: number;
  
  /** 品詞情報（オプション） */
  partOfSpeech?: string;
}

/**
 * 解析結果
 */
export interface AnalysisResult {
  /** 解析対象ドキュメントURI */
  documentUri: string;
  
  /** 段落一覧 */
  paragraphs: Paragraph[];
  
  /** 段落IDとキーワードのマップ */
  keywords: Map<string, Keyword[]>;
  
  /** 段落IDとスコアのマップ */
  scores: Map<string, Scores>;
  
  /** 解析実行時刻 */
  timestamp: number;
}