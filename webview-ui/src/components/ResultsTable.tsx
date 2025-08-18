import React from 'react';
import { Div, Text, Table, Tbody, Thead, Tr, Th, Td } from "atomize";

const ResultsTable = () => {
  return (
    <Div>
      <Text tag="h2" textSize="title" m={{ b: "1rem" }}>
        段落別詳細
      </Text>
      <Table>
        <Thead>
          <Tr>
            <Th>段落</Th>
            <Th>文字数</Th>
            <Th>キーワード</Th>
            <Th>ROI</Th>
            <Th>LLM</Th>
            <Th>操作</Th>
          </Tr>
        </Thead>
        <Tbody>
          {/* Rows will be mapped here */}
          <Tr>
            <Td>（サンプル）これは段落のプレビューです...</Td>
            <Td>123</Td>
            <Td>キーワード1, キーワード2</Td>
            <Td>0.85</Td>
            <Td>0.92</Td>
            <Td>ジャンプ</Td>
          </Tr>
        </Tbody>
      </Table>
    </Div>
  );
};

export default ResultsTable;
