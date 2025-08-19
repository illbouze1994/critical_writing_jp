import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import ParagraphCard, { ParagraphData } from './ParagraphCard';

// VSCode APIのモック（ブラウザでのテスト用）
const vscodeApi = typeof acquireVsCodeApi === 'function'
  ? acquireVsCodeApi()
  : { postMessage: (message: any) => console.log('postMessage (mock)', message) };

interface ParagraphDashboardProps {
  paragraphs: ParagraphData[];
}

const ParagraphDashboard: React.FC<ParagraphDashboardProps> = ({ paragraphs: initialParagraphs }) => {
  const [paragraphs, setParagraphs] = useState<ParagraphData[]>(initialParagraphs);

  useEffect(() => {
    setParagraphs(initialParagraphs);
  }, [initialParagraphs]);

  const onDragEnd = (result: DropResult) => {
    const { source, destination } = result;

    if (!destination) {
      return;
    }

    const reorderedParagraphs = Array.from(paragraphs);
    const [removed] = reorderedParagraphs.splice(source.index, 1);
    reorderedParagraphs.splice(destination.index, 0, removed);

    setParagraphs(reorderedParagraphs);

    // 拡張機能に段落の新しい順序を通知
    vscodeApi.postMessage({
      command: 'reorderParagraphs',
      payload: reorderedParagraphs.map(p => p.id),
    });
  };

  // TODO: useEffectで拡張機能からのデータを受け取り、paragraphsステートを更新するロジックを追加

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="paragraphs">
        {(provided) => (
          <div {...provided.droppableProps} ref={provided.innerRef}>
            {paragraphs.map((p, index) => (
              <Draggable key={p.id} draggableId={p.id} index={index}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    style={{
                      ...provided.draggableProps.style,
                      marginBottom: '1rem',
                    }}
                  >
                    <ParagraphCard paragraph={p} />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
};

export default ParagraphDashboard;
