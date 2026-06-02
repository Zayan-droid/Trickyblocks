import { useGameStore } from '@/store/gameStore';
import DifficultyBar from './DifficultyBar';

interface Props {
  height: number;
  onPause: () => void;
}

export default function HUD({ height, onPause }: Props) {
  const score = useGameStore((s) => s.score);
  const combo = useGameStore((s) => s.combo);
  const difficulty = useGameStore((s) => s.difficulty);
  const level = useGameStore((s) => s.level);
  const mode = useGameStore((s) => s.mode);
  const platform = useGameStore((s) => s.platform);
  const challenge = useGameStore((s) => s.challenge);
  const goalScore = useGameStore((s) => s.goalScore);
  const goalHeight = useGameStore((s) => s.goalHeight);

  const iceMode = platform === 'ice';
  const jellyMode = platform === 'jelly';
  const panelCls = iceMode ? 'ice-panel' : jellyMode ? 'jelly-panel' : 'panel';
  const dimText = iceMode
    ? 'text-[#3A6A8F]'
    : jellyMode
      ? 'text-[#9A7FB5]'
      : 'text-white/70';
  const heightText = dimText;
  const strongText = iceMode ? 'text-[#233B63]' : jellyMode ? 'text-[#6E5AA5]' : '';
  const accentCombo = iceMode
    ? 'text-[#5CB8E8]'
    : jellyMode
      ? 'text-[#FF7EB6]'
      : 'text-accent';

  const scoreFrac = goalScore > 0 ? Math.min(1, score / goalScore) : 0;
  const heightFrac = goalHeight > 0 ? Math.min(1, height / goalHeight) : 0;

  return (
    <div className="absolute top-0 inset-x-0 px-2 sm:px-3 pt-[max(env(safe-area-inset-top),12px)] z-20 pointer-events-none">
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className={`${panelCls} pointer-events-auto px-2 sm:px-3 py-1.5 sm:py-2 min-w-[88px] sm:min-w-[112px]`}>
          <div className={`text-[10px] uppercase tracking-widest ${dimText}`}>Score</div>
          <div className={`font-display text-xl sm:text-2xl leading-none ${strongText}`}>{score}</div>
          {mode === 'endless' && (
            <div className={`text-[10px] mt-1 ${dimText}`}>Level {level}</div>
          )}
          {combo > 1 && (
            <div className={`mt-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-widest ${accentCombo} animate-pop`}>
              <span>x{combo}</span>
              <span className={dimText}>combo</span>
            </div>
          )}
        </div>

        <div className={`${panelCls} pointer-events-auto px-2 sm:px-3 py-1.5 sm:py-2 flex flex-col items-center gap-1 min-w-0`}>
          <DifficultyBar difficulty={difficulty} iceMode={iceMode} jellyMode={jellyMode} />
          <div className={`text-[10px] tracking-widest uppercase whitespace-nowrap ${heightText}`}>
            {Math.round(height / 6)}m tall
          </div>
        </div>

        <button
          onClick={onPause}
          className={`${panelCls} pointer-events-auto w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-lg sm:text-xl active:scale-95 shrink-0 ${strongText}`}
          aria-label="Pause"
        >
          ⏸
        </button>
      </div>

      {(mode === 'daily' || mode === 'challenge') && challenge && (
        <div className={`mt-3 ${panelCls} px-3 py-2 pointer-events-auto`}>
          <div className="flex items-center justify-between">
            <div className={`font-display text-sm ${strongText}`}>{challenge.name}</div>
            <div className={`text-[10px] uppercase tracking-widest ${dimText}`}>
              {mode === 'daily' ? 'Daily' : 'Challenge'}
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <Bar
              label={`Score ${score}/${goalScore}`}
              frac={scoreFrac}
              iceMode={iceMode}
              jellyMode={jellyMode}
            />
            <Bar
              label={`Height ${Math.round(height / 6)}/${Math.round(goalHeight / 6)}m`}
              frac={heightFrac}
              iceMode={iceMode}
              jellyMode={jellyMode}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Bar({
  label,
  frac,
  iceMode,
  jellyMode,
}: {
  label: string;
  frac: number;
  iceMode?: boolean;
  jellyMode?: boolean;
}) {
  const labelCls = iceMode
    ? 'text-[10px] text-[#3A6A8F]'
    : jellyMode
      ? 'text-[10px] text-[#9A7FB5]'
      : 'text-[10px] text-white/75';
  const trackCls = iceMode
    ? 'mt-1 h-1.5 rounded-full bg-[#D5E8F5] overflow-hidden'
    : jellyMode
      ? 'mt-1 h-1.5 rounded-full bg-[#F3D9E8] overflow-hidden'
      : 'mt-1 h-1.5 rounded-full bg-surface-2 overflow-hidden';
  const fillCls =
    iceMode || jellyMode
      ? 'h-full transition-all duration-300'
      : 'h-full bg-accent transition-all duration-300';
  const fillStyle =
    iceMode || jellyMode
      ? {
          width: `${Math.min(100, frac * 100)}%`,
          background: iceMode ? '#5CB8E8' : '#FF7EB6',
        }
      : { width: `${Math.min(100, frac * 100)}%` };
  return (
    <div>
      <div className={labelCls}>{label}</div>
      <div className={trackCls}>
        <div className={fillCls} style={fillStyle} />
      </div>
    </div>
  );
}
