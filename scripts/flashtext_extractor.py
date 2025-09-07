#!/usr/bin/env python3
import sys
import json

try:
    from flashtext import KeywordProcessor
except Exception as e:
    KeywordProcessor = None

def main():
    if len(sys.argv) < 2:
        print("[]")
        return
    try:
        payload = sys.argv[1]
        data = json.loads(payload)
        paragraphs = data.get('paragraphs', [])
        terms = data.get('terms', [])

        if KeywordProcessor is None or not terms:
            # Fallback: return empty matches
            print(json.dumps([{ 'id': p.get('id'), 'matches': {} } for p in paragraphs]))
            return

        kp = KeywordProcessor(case_sensitive=False)
        for t in terms:
            if isinstance(t, str) and t.strip():
                kp.add_keyword(t)

        output = []
        for p in paragraphs:
            text = p.get('text') or ''
            pid = p.get('id')
            # extract_keywords returns list of matched terms
            matches = kp.extract_keywords(text)
            counts = {}
            for m in matches:
                counts[m] = counts.get(m, 0) + 1
            output.append({ 'id': pid, 'matches': counts })

        print(json.dumps(output))
    except Exception:
        # On any error, emit empty result to avoid breaking the extension
        print("[]")

if __name__ == '__main__':
    main()
