import * as path from 'path';
import * as vscode from 'vscode';
import { Paragraph, Keyword } from '../core/types';

// Use require to avoid TypeScript type dependency on 'python-shell'
let PythonShellRun: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const py = require('python-shell');
  PythonShellRun = py.PythonShell?.run;
} catch {
  PythonShellRun = undefined;
}

export interface FlashTextInput {
  paragraphs: { id: string; text: string }[];
  terms: string[];
}

export interface FlashTextOutputItem {
  id: string;
  matches: { [term: string]: number };
}

/**
 * Extract keywords using Python FlashText via python-shell.
 * Strategy:
 * 1) Build candidate terms with lightweight regex from text (katakana, alnum, non-hiragana >= 2)
 * 2) Send to Python script which uses FlashText to count occurrences per paragraph
 * 3) Convert to Keyword[] with frequency and heuristic score
 */
export async function extractWithFlashText(paragraphs: Paragraph[], context?: vscode.ExtensionContext): Promise<Map<string, Keyword[]>> {
  const result = new Map<string, Keyword[]>();

  if (!paragraphs || paragraphs.length === 0) return result;

  const terms = buildCandidateTerms(paragraphs);
  if (terms.size === 0) return result;

  const input: FlashTextInput = {
    paragraphs: paragraphs.map(p => ({ id: p.id, text: p.text || '' })),
    terms: Array.from(terms)
  };

  try {
    const scriptPath = resolvePythonScriptPath(context);

    if (!PythonShellRun) {
      console.warn('[FlashTextBridge] python-shell not available. Returning empty result.');
      return result;
    }

    const payload = JSON.stringify(input);

    const lines: string[] = await new Promise((resolve, reject) => {
      try {
        PythonShellRun(scriptPath, {
          mode: 'text',
          pythonOptions: ['-u'],
          args: [payload]
        }, (err: any, results: string[] | undefined) => {
          if (err) return reject(err);
          resolve(results || []);
        });
      } catch (e) {
        reject(e);
      }
    });

    const jsonStr = (lines && lines.length > 0) ? lines.join('\n') : '';
    if (!jsonStr) return result;

    const parsed: FlashTextOutputItem[] = JSON.parse(jsonStr);

    for (const item of parsed) {
      const keywords: Keyword[] = [];
      for (const term of Object.keys(item.matches || {})) {
        const freq = item.matches[term] ?? 0;
        if (freq <= 0) continue;
        // Simple heuristic score: cap at 1.0
        const score = Math.min(1, freq / 5);
        keywords.push({ text: term, frequency: freq, score, partOfSpeech: 'unknown' });
      }
      // Sort by score desc, limit 20
      result.set(item.id, keywords.sort((a, b) => b.score - a.score).slice(0, 20));
    }
  } catch (error) {
    console.warn('[FlashTextBridge] Failed to run FlashText:', error);
    return result; // empty result on failure
  }

  return result;
}

function resolvePythonScriptPath(context?: vscode.ExtensionContext): string {
  // Prefer extension-relative path if available; fallback to project scripts directory
  const relative = path.join('scripts', 'flashtext_extractor.py');
  if (context && (context as any).extensionPath) {
    return path.join((context as any).extensionPath, relative);
  }
  // Fallback to process.cwd()
  return path.join(process.cwd(), relative);
}

function buildCandidateTerms(paragraphs: Paragraph[]): Set<string> {
  const terms = new Set<string>();
  for (const p of paragraphs) {
    const text = (p.text || '').trim();
    if (!text) continue;

    // Katakana words
    matchAndAdd(text, /[\u30A1-\u30FA\u30FC]{2,}/g, terms);
    // Alphanumeric tokens
    matchAndAdd(text, /[A-Za-z0-9]{2,}/g, terms);
    // Non-hiragana sequences length>=3 (kanji, katakana, symbols)
    matchAndAdd(text, /[^\u3041-\u3096\s\u3000]{3,}/g, terms);
  }
  return terms;
}

function matchAndAdd(text: string, regex: RegExp, terms: Set<string>) {
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    const term = m[0];
    if (!seen.has(term)) {
      terms.add(term);
      seen.add(term);
    }
  }
}
