interface Props {
  onUndo: () => void;
  onShuffle: () => void;
  onPin: () => void;
  undosLeft: number;
  shufflesLeft: number;
  pinsLeft: number;
  pinArmed: boolean;
}

interface ActionDef {
  key: 'undo' | 'shuffle' | 'pin';
  icon: string;
  label: string;
}

const ACTIONS: ActionDef[] = [
  { key: 'undo', icon: '↶', label: 'Undo' },
  { key: 'shuffle', icon: '♻', label: 'Shuffle' },
  { key: 'pin', icon: '📌', label: 'Pin' },
];

export default function ActionsTray({
  onUndo,
  onShuffle,
  onPin,
  undosLeft,
  shufflesLeft,
  pinsLeft,
  pinArmed,
}: Props) {
  const handle = (k: ActionDef['key']) => {
    if (k === 'undo') onUndo();
    else if (k === 'shuffle') onShuffle();
    else if (k === 'pin') onPin();
  };

  const countFor = (k: ActionDef['key']) =>
    k === 'undo' ? undosLeft : k === 'shuffle' ? shufflesLeft : pinsLeft;

  return (
    <div className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 z-20 flex flex-col items-end gap-1.5 sm:gap-2 pointer-events-auto pr-[max(env(safe-area-inset-right),0px)]">
      <div className="text-[9px] font-display tracking-[0.2em] text-accent/80 uppercase select-none">
        Actions
      </div>
      {ACTIONS.map(({ key, icon, label }) => {
        const remaining = countFor(key);
        const armed = key === 'pin' && pinArmed;
        // Pin stays clickable when armed (so it can be toggled off) even if
        // remaining is 0 — the click will just disarm.
        const disabled = !armed && remaining <= 0;
        return (
          <button
            key={key}
            onClick={() => handle(key)}
            disabled={disabled}
            aria-label={label}
            aria-pressed={armed}
            title={armed ? `${label} · armed` : `${label} · ${remaining} left`}
            className={[
              'relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex flex-col items-center justify-center',
              'transition-all duration-150 active:scale-95 select-none',
              'border shadow-[0_4px_0_rgba(0,0,0,0.45)]',
              disabled
                ? 'bg-surface border-white/10 text-white/40 cursor-not-allowed'
                : armed
                  ? 'bg-accent border-accent text-black ring-2 ring-accent animate-pulse'
                  : 'bg-surface border-white/10 text-white hover:border-accent/60',
            ].join(' ')}
          >
            <span className="text-lg sm:text-xl leading-none">
              {icon}
            </span>
            <span className="text-[9px] font-display tracking-wider mt-0.5 leading-none">
              {label.toUpperCase()}
            </span>
            <span
              className={[
                'absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1',
                'rounded-full text-[10px] font-display leading-[18px] text-center',
                disabled
                  ? 'bg-surface-2 text-white/50 border border-white/10'
                  : 'bg-accent text-black',
              ].join(' ')}
            >
              {remaining}
            </span>
          </button>
        );
      })}
    </div>
  );
}
