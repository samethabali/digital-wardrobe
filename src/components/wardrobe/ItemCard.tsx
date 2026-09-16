import React from 'react';
import { Check } from 'lucide-react';
import type { WardrobeItem } from '../../types';
import { CATEGORY_LABELS } from '../../constants/wardrobe';
import { cx, ItemImage } from '../ui/primitives';

interface Props {
  item: WardrobeItem;
  onClick: () => void;
  selectable?: boolean;
  selected?: boolean;
}

export default React.memo(function ItemCard({ item, onClick, selectable, selected }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx('group text-left w-full transition-transform active:scale-[0.98]', selectable && selected && 'scale-[0.97]')}
      aria-pressed={selectable ? selected : undefined}
    >
      <div className={cx('relative rounded-2xl transition-shadow', selected && 'ring-2 ring-ink ring-offset-2 ring-offset-canvas')}>
        <ItemImage item={item} className="aspect-[4/5]" />
        {selectable && (
          <span className={cx(
            'absolute top-2.5 right-2.5 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors',
            selected ? 'bg-ink border-ink text-canvas' : 'bg-surface/80 border-surface backdrop-blur',
          )}>
            {selected && <Check className="w-4 h-4" strokeWidth={3} />}
          </span>
        )}
        {!selectable && typeof item.wearCount === 'number' && item.wearCount > 0 && (
          <span className="absolute bottom-2 left-2 px-2 h-6 rounded-full bg-surface/85 backdrop-blur text-[11px] font-semibold text-ink-2 flex items-center">
            {item.wearCount}× giyildi
          </span>
        )}
      </div>
      <div className="pt-2 px-0.5">
        <p className="text-[14px] font-semibold text-ink truncate leading-snug">{item.name}</p>
        <p className="text-[12px] text-ink-3 truncate">
          {CATEGORY_LABELS[item.category] || item.category}
          {item.color ? ` · ${item.color}` : ''}
        </p>
      </div>
    </button>
  );
});
