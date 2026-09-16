import React from 'react';
import { displayImage } from '../constants/wardrobe';

interface CollageItem {
  id: string;
  name: string;
  category: string;
  imagePath: string;
  cutoutImagePath?: string | null;
}

// Düz serim (flat-lay) yerleşimi: dış giyim solda, üst/tek parça ortada, alt altta, ayakkabı en altta, aksesuarlar sağda.
const AREAS: Record<string, string> = {
  outerwear: 'outer',
  top: 'top',
  onepiece: 'top',
  bottom: 'bottom',
  shoes: 'shoes',
  accessory: 'acc',
  makeup: 'acc',
};

export default function OutfitCollage({ items, className = '' }: { items: CollageItem[]; className?: string }) {
  const byArea = new Map<string, CollageItem[]>();
  for (const item of items) {
    const area = AREAS[item.category] || 'acc';
    byArea.set(area, [...(byArea.get(area) || []), item]);
  }
  const hasOnepiece = items.some(i => i.category === 'onepiece');
  const withoutCutout = items.filter(i => !i.cutoutImagePath).length;

  const cell = (area: string, extra = '') => {
    const list = byArea.get(area) || [];
    if (list.length === 0) return <div style={{ gridArea: area }} />;
    return (
      <div style={{ gridArea: area }} className={`flex flex-col gap-2 items-center justify-center min-h-0 ${extra}`}>
        {list.map(item => (
          <img
            key={item.id}
            src={displayImage(item)}
            alt={item.name}
            title={item.name}
            loading="lazy"
            className={`max-h-full max-w-full object-contain drop-shadow-md ${item.cutoutImagePath ? '' : 'rounded-xl'}`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className={className}>
      <div
        className="grid gap-3 p-4 rounded-3xl bg-surface-2 border border-line aspect-[4/5] sm:aspect-[5/4]"
        style={{
          gridTemplateColumns: '1fr 1.3fr 0.7fr',
          gridTemplateRows: hasOnepiece ? '1.6fr 0.2fr 0.7fr' : '1fr 1fr 0.6fr',
          gridTemplateAreas: `"outer top acc" "outer bottom acc" "outer shoes acc"`,
        }}
      >
        {cell('outer')}
        {cell('top')}
        {cell('bottom')}
        {cell('shoes')}
        {cell('acc', 'justify-start')}
      </div>
      {withoutCutout > 0 && (
        <p className="text-[11px] text-ink-3 mt-2 text-center">
          {withoutCutout} parçanın arka planı kaldırılmadı. Parça detayından "Arka Planı Kaldır" ile kolaj daha temiz görünür.
        </p>
      )}
    </div>
  );
}
