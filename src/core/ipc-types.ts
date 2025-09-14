/**
 * IPC通信の型定義
 * Extension Host、Worker、Webview間の通信で使用される
 */

/**
 * ワーカーの種類
 */
export type WorkerKind = 'keyword' | 'roi' | 'style' | 'llm';

/**
 * メッセージのベースインタフェース
 */
export interface MsgBase {
  /** メッセージタイプ */
  type: string;
  
  /** リクエストID（非同期処理識別用） */
  reqId: string;
}

/**
 * 解析リクエストメッセージ（Extension -> Worker）
 */
export interface AnalyzeReq extends MsgBase {
  type: 'analyze';
  
  /** ワーカーの種類 */
  kind: WorkerKind;
  
  /** 解析対象の段落データ */
  paragraphs: Array<{
    id: string;
    text: string;
  }>;
  
  /** 解析設定（必要な部分のみ） */
  settings: any;
}

/**
 * 解析結果メッセージ（Worker -> Extension）
 */
export interface AnalyzeRes extends MsgBase {
  type: 'result';
  
  /** ワーカーの種類 */
  kind: WorkerKind;
  
  /** 解析結果データ（種類によって異なる構造） */
  data: any;
  
  /** 処理時間（ミリ秒） */
  elapsedMs: number;
}

/**
 * エラーメッセージ（Worker -> Extension）
 */
export interface ErrorRes extends MsgBase {
  type: 'error';
  
  /** ワーカーの種類 */
  kind: WorkerKind;
  
  /** エラー内容（簡潔な文字列） */
  error: string;
}

/**
 * ワーカー通信で使用されるメッセージの統合型
 */
export type WorkerMsg = AnalyzeReq | AnalyzeRes | ErrorRes;

/**
 * パネル更新メッセージ（Extension -> Webview）
 */
export interface PanelUpdate {
  type: 'panel/update';
  
  /** 更新内容のペイロード */
  payload: {
    /** 全体統計 */
    summary: {
      /** 総段落数 */
      total: number;
      
      /** 総文字数 */
      chars: number;

      /** 閾値超過段落数 */
      over: number;
      
      /** 閾値未満段落数 */
      under: number;
    };

    /** グラフ用データ */
    charts: {
      /** 文字種バランス */
      charBalance: { name: string; value: number }[];

      /** 常用漢字の使用率 */
      joyoKanji: { name: string; value: number }[];
    };
    
    /** 段落ごとの詳細データ */
    rows: Array<{
      /** 段落ID */
      id: string;
      
      /** 段落の先頭プレビューテキスト */
      head: string;
      
      /** 文字数 */
      chars: number;
      
      /** キーワードリスト */
      kw: string[];
      
      /** ROIスコア（オプション） */
      roi?: number;
      
      /** LLMスコア（オプション） */
      llm?: number;
    }>;
  };
}

/**
 * LLM評価結果の型
 */
export interface LLMEvaluationResult {
  /** 段落ID */
  paragraphId: string;
  
  /** スタイルスコア（0-1範囲） */
  style: number;
  
  /** 論証スコア（0-1範囲） */
  argumentation: number;
  
  /** 評価根拠の説明（オプション） */
  explain?: Record<string, number>;
}

/**
 * Google Books検索結果の型
 */
export interface GoogleBooksResult {
  /** 書籍タイトル */
  title: string;
  
  /** 著者名 */
  author: string;
  
  /** 出版年 */
  year?: string;
  
  /** テキストスニペット */
  snippet?: string;
  
  /** Google Books上のURL */
  url?: string;
}

/**
 * Books検索リクエストの型
 */
export interface BooksSearchRequest {
  /** 検索フレーズ */
  phrase: string;
  
  /** 検索ヒント（オプション） */
  hint?: {
    /** 著者名 */
    author?: string;
    
    /** 書名 */
    title?: string;
  };
}

/**
 * キャンセル可能な処理のための制御情報
 */
export interface CancelInfo {
  /** キャンセルシグナル */
  signal: AbortSignal;
  
  /** タイムアウト時間（ミリ秒） */
  timeoutMs?: number;
}