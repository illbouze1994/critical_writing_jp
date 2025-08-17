# CriticalWritingJp テスト文書

この文書は、CriticalWritingJp拡張機能の動作テスト用に作成されたサンプル文書です。

## 短い段落のテスト

短い段落です。この段落は200文字未満なので、不足として黄色くハイライトされるはずです。

## 通常の段落のテスト

この段落は適切な長さの段落です。200文字以上800文字未満の範囲にあるため、正常な段落として扱われます。段落解析機能により、文字数がカウントされ、適切な範囲内であることが確認されます。この機能により、文書の品質を向上させることができます。執筆者は段落の長さを意識して、読みやすい文章を作成できるようになります。

## 長い段落のテスト

この段落は800文字を超える非常に長い段落のテストです。このような長い段落は読みにくくなる傾向があるため、赤色でハイライトされるはずです。Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.

## リスト項目のテスト

- これはリスト項目の段落です
- リスト項目として正しく認識されるはずです
- 段落種類が「listItem」として分類されます

1. 番号付きリストの項目です
2. こちらも「listItem」として分類されるはずです
3. 段落解析機能のテストに使用します

## 引用ブロックのテスト

> これは引用ブロックです。引用ブロックは「quote」として分類され、
> 通常の段落とは区別されて処理されます。
> 文字数カウントの対象外になる場合もあります。

## コードブロックのテスト

```javascript
// これはコードブロックです
function example() {
    console.log("コードブロックは解析対象外となります");
    return true;
}
```

    // インデントによるコードブロック
    const indentedCode = true;

## ディスコースマーカーのテスト

しかし、この機能にはいくつかの制限があります。したがって、ユーザーは注意深く使用する必要があります。また、設定を適切に調整することも重要です。さらに、定期的なアップデートにより機能が改善されていく予定です。つまり、継続的な開発が行われているということです。なぜなら、ユーザーのフィードバックを重視しているからです。

## 引用表記のテスト

【田中太郎『学術執筆の技法』2023年】によると、適切な段落構成は読みやすさを向上させます。また、(Smith 2022) の研究でも同様の結果が報告されています。

## 脚注のテスト

この文書には脚注も含まれています[^1]。脚注は文書の詳細情報を提供するために使用されます[^2]。

[^1]: これは最初の脚注です。
[^2]: これは二番目の脚注で、脚注として正しく分類されるはずです。

## テスト手順

1. VS Codeでこの文書を開く
2. コマンドパレットで「CriticalWritingJp: Toggle Panel」を実行
3. パネルが表示され、各段落の情報が表示されることを確認
4. 短い段落と長い段落がハイライトされることを確認
5. ステータスバーに文書の統計情報が表示されることを確認
6. パネルの段落をクリックして、該当箇所にジャンプすることを確認

以上でテストは完了です。