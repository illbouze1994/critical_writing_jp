import React, { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import ParagraphCard, { ParagraphData } from './ParagraphCard';

const vscodeApi = typeof acquireVsCodeApi === 'function'
  ? acquireVsCodeApi()
  : { postMessage: (message: any) => console.log('postMessage (mock)', message) };

interface SortableItemProps {
  id: string;
  paragraph: ParagraphData;
}

function SortableItem(props: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: props.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    marginBottom: '1rem',
  };

  return (
    <div ref={setNodeRef} style={style}>
      <ParagraphCard
        paragraph={props.paragraph}
        attributes={attributes}
        listeners={listeners}
      />
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ParagraphCard paragraph={props.paragraph} />
    </div>
  );
}

interface ParagraphDashboardProps {
  paragraphs: ParagraphData[];
}

const ParagraphDashboard: React.FC<ParagraphDashboardProps> = ({ paragraphs: initialParagraphs }) => {
  const [paragraphs, setParagraphs] = useState<ParagraphData[]>(initialParagraphs);

  useEffect(() => {
    setParagraphs(initialParagraphs);
  }, [initialParagraphs]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setParagraphs((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const reorderedParagraphs = arrayMove(items, oldIndex, newIndex);

        // Notify the extension about the reorder
        vscodeApi.postMessage({
          command: 'reorderParagraphs',
          payload: reorderedParagraphs.map(p => p.id),
        });

        return reorderedParagraphs;
      });
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={paragraphs.map(p => p.id)}
        strategy={verticalListSortingStrategy}
      >
        <div>
          {paragraphs.map((p) => (
            <SortableItem key={p.id} id={p.id} paragraph={p} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};

export default ParagraphDashboard;
