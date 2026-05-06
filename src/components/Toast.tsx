import { useEffect, useState } from 'react';

interface Props {
  message: string | null;
  onDone?: () => void;
}

export default function Toast({ message, onDone }: Props) {
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    setShown(message);
    const t = setTimeout(() => {
      setShown(null);
      onDone?.();
    }, 1600);
    return () => clearTimeout(t);
  }, [message, onDone]);

  if (!shown) return null;
  return (
    <div className="absolute inset-x-0 top-24 z-40 flex justify-center pointer-events-none">
      <div className="px-4 py-2 bg-surface border border-white/10 rounded-full text-white text-sm font-display tracking-wider animate-pop">
        {shown}
      </div>
    </div>
  );
}
