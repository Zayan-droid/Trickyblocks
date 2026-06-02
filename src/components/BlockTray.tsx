import { forwardRef, useEffect, useRef, useState } from 'react';
import type { BlockSpec } from '@/game/types';
import { useGameStore } from '@/store/gameStore';
import BlockPreview from './BlockPreview';

interface Props {
  blocks: BlockSpec[];
  capacity: number;
  onDragStart: (spec: BlockSpec, x: number, y: number) => void;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: (cancelled: boolean) => void;
}

const BlockTray = forwardRef<HTMLDivElement, Props>(function BlockTray(
  { blocks, capacity, onDragStart, onDragMove, onDragEnd },
  ref,
) {
  const [dragging, setDragging] = useState<string | null>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const [slotPx, setSlotPx] = useState(64);
  const iceMode = useGameStore((s) => s.platform === 'ice');

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => onDragMove(e.clientX, e.clientY);
    const up = () => {
      onDragEnd(false);
      setDragging(null);
    };
    const cancel = () => {
      onDragEnd(true);
      setDragging(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  }, [dragging, onDragEnd, onDragMove]);

  useEffect(() => {
    if (!slotRef.current) return;
    const el = slotRef.current;
    const ro = new ResizeObserver(() => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setSlotPx(Math.max(28, Math.floor(w * 0.78)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [capacity]);

  const slots = Array.from({ length: capacity }).map((_, i) => blocks[i] || null);

  return (
    <div
      ref={ref}
      data-tray-root
      className="absolute bottom-0 inset-x-0 z-20 pb-[max(env(safe-area-inset-bottom),12px)] pointer-events-none"
    >
      <div className="mx-auto w-full max-w-md px-2 sm:px-3 pointer-events-auto">
        <div
          className={`px-2 sm:px-3 py-2 sm:py-3 flex items-end justify-center gap-1.5 sm:gap-3 ${
            iceMode ? 'ice-panel' : 'panel border border-accent/30'
          }`}
        >
          {slots.map((spec, i) => (
            <div
              key={spec?.id ?? `empty-${i}`}
              ref={i === 0 ? slotRef : undefined}
              className="relative flex-1 min-w-0 max-w-20 flex flex-col items-center transition-transform"
            >
              <div
                className={`relative w-full aspect-square rounded-2xl flex items-center justify-center ${
                  iceMode
                    ? spec
                      ? 'bg-[#EAF6FF] ring-1 ring-[#BEE8FF] shadow-[inset_0_2px_4px_rgba(143,214,255,0.35)]'
                      : 'bg-[#F8FBFF]/60 border border-dashed border-[#BEE8FF]'
                    : spec
                      ? 'bg-surface-2 ring-1 ring-white/15'
                      : 'bg-surface border border-dashed border-white/15'
                }`}
              >
                {spec && (
                  <button
                    type="button"
                    className="w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none"
                    style={{ touchAction: 'none' }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      const el = e.currentTarget;
                      try {
                        el.setPointerCapture(e.pointerId);
                      } catch {
                        // Older browsers without pointer capture — events still fire on window.
                      }
                      setDragging(spec.id);
                      onDragStart(spec, e.clientX, e.clientY);
                    }}
                  >
                    <BlockPreview spec={spec} size={slotPx} />
                  </button>
                )}
              </div>
              <div className="h-3 mt-1 text-[9px] font-display tracking-wider uppercase leading-none text-center">
                <span className={iceMode ? 'text-[#3A6A8F]' : 'text-white/40'}>
                  {spec ? spec.shape : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

export default BlockTray;
