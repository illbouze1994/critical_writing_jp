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
import { DraggableAttributes } from '@dnd-kit/core';
import { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import vscodeApi from '../vscodeApi';

type SortableItemProps = {
  id: string;
  paragraph: ParagraphData;
};

const SortableItem: React.FC<SortableItemProps> = (props) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: props.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    marginBottom: '1rem',
  };

  return (
    <div ref={setNodeRef} style={style}>
      <ParagraphCard
        paragraph={props.paragraph}
        attributes={attributes as DraggableAttributes}
        listeners={listeners as SyntheticListenerMap}
      />
    </div>
  );
};

type ParagraphDashboardProps = {
  paragraphs: ParagraphData[];
};

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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setParagraphs((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        if (oldIndex === -1 || newIndex === -1) {
            return items;
        }

        const reorderedParagraphs = arrayMove(items, oldIndex, newIndex);

        vscodeApi.postMessage({
          command: 'reorderParagraphs',
          payload: reorderedParagraphs.map((p) => p.id),
        });

        return reorderedParagraphs;
      });
    }
  };

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
        {paragraphs.map((p) => (
          <SortableItem key={p.id} id={p.id} paragraph={p} />
        ))}
      </SortableContext>
    </DndContext>
  );
};

export default ParagraphDashboard;
