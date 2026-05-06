import { useEffect, useState } from 'react';

interface Pop {
  id: number;
  text: string;
  ts: number;
}

interface Props {
  triggers: Array<{ amount: number; breakdown: Array<[string, number]> }>;
}

export default function ScorePop({ triggers }: Props) {
  const [pops, setPops] = useState<Pop[]>([]);

  useEffect(() => {
    if (triggers.length === 0) return;
    const last = triggers[triggers.length - 1];
    const id = Date.now();
    const big = last.breakdown.find(([k]) => k.startsWith('combo')) || last.breakdown[0];
    const text = big ? `+${last.amount}` : `+${last.amount}`;
    setPops((prev) => [...prev, { id, text, ts: Date.now() }]);
    const t = setTimeout(() => {
      setPops((prev) => prev.filter((p) => p.id !== id));
    }, 1100);
    return () => clearTimeout(t);
  }, [triggers]);

  return (
    <div className="absolute inset-0 pointer-events-none z-30 flex items-start justify-center pt-32">
      {pops.map((p) => (
        <div
          key={p.id}
          className="absolute font-display text-3xl text-accent"
          style={{
            transform: `translateY(${-Math.min(70, (Date.now() - p.ts) * 0.08)}px)`,
            opacity: Math.max(0, 1 - (Date.now() - p.ts) / 1100),
            textShadow: '0 0 18px rgba(255,214,10,0.7)',
          }}
        >
          {p.text}
        </div>
      ))}
    </div>
  );
}
