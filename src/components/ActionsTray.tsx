import { useGameStore } from '@/store/gameStore';

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
  const iceMode = useGameStore((s) => s.platform === 'ice');

  const handle = (k: ActionDef['key']) => {
    if (k === 'undo') onUndo();
    else if (k === 'shuffle') onShuffle();
    else if (k === 'pin') onPin();
  };

  const countFor = (k: ActionDef['key']) =>
    k === 'undo' ? undosLeft : k === 'shuffle' ? shufflesLeft : pinsLeft;

  const headerCls = iceMode
    ? 'text-[9px] font-display tracking-[0.2em] text-[#233B63]/70 uppercase select-none'
    : 'text-[9px] font-display tracking-[0.2em] text-accent/80 uppercase select-none';

  return (
    <div className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 z-20 flex flex-col items-end gap-1.5 sm:gap-2 pointer-events-auto pr-[max(env(safe-area-inset-right),0px)]">
      <div className={headerCls}>Actions</div>
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
              'transition-all duration-150 active:scale-95 select-none border',
              iceMode
                ? iceButtonCls(disabled, armed)
                : classicButtonCls(disabled, armed),
            ].join(' ')}
          >
            <span className="text-lg sm:text-xl leading-none">{icon}</span>
            <span className="text-[9px] font-display tracking-wider mt-0.5 leading-none">
              {label.toUpperCase()}
            </span>
            <span
              className={[
                'absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1',
                'rounded-full text-[10px] font-display leading-[18px] text-center',
                iceMode
                  ? iceBadgeCls(disabled)
                  : disabled
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

function classicButtonCls(disabled: boolean, armed: boolean): string {
  if (disabled) return 'bg-surface border-white/10 text-white/40 cursor-not-allowed shadow-[0_4px_0_rgba(0,0,0,0.45)]';
  if (armed)
    return 'bg-accent border-accent text-black ring-2 ring-accent animate-pulse shadow-[0_4px_0_rgba(0,0,0,0.45)]';
  return 'bg-surface border-white/10 text-white hover:border-accent/60 shadow-[0_4px_0_rgba(0,0,0,0.45)]';
}

// Carved-ice action buttons. Idle blocks read as clean frozen ice with a
// glacier-blue "carved" base shadow and a snow-lit top edge (inset white).
// Hover adds a soft frost shimmer. The pin's armed state borrows the theme's
// only warm accent (Warm Orange) since it acts as an active power-up.
function iceButtonCls(disabled: boolean, armed: boolean): string {
  const carved =
    'shadow-[0_4px_0_rgba(92,184,232,0.5),0_8px_14px_rgba(35,59,99,0.18),inset_0_2px_0_rgba(255,255,255,0.85)]';
  if (disabled)
    return `bg-[#EAF6FF] border-[#D5E8F5] text-[#9DB8CC] cursor-not-allowed shadow-[0_3px_0_rgba(143,214,255,0.3)]`;
  if (armed)
    return `bg-gradient-to-b from-[#FFD4A8] to-[#FFB36A] border-[#FFB36A] text-[#5A3A1A] ring-2 ring-[#FFB36A] animate-pulse shadow-[0_4px_0_rgba(214,140,70,0.5),inset_0_2px_0_rgba(255,255,255,0.6)]`;
  return `bg-gradient-to-b from-[#F8FBFF] to-[#BEE8FF] border-[#BEE8FF] text-[#233B63] hover:from-white hover:to-[#DDF8FF] hover:brightness-105 ${carved}`;
}

// Move-counter badge. The palette reserves Warm Orange for counters, warnings
// and power-ups, so an active counter glows orange against the cool buttons.
function iceBadgeCls(disabled: boolean): string {
  return disabled
    ? 'bg-[#EAF6FF] text-[#9DB8CC] border border-[#D5E8F5]'
    : 'bg-[#FFB36A] text-[#5A3A1A] shadow-[0_1px_3px_rgba(214,140,70,0.5)]';
}
