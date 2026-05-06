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
  const challenge = useGameStore((s) => s.challenge);
  const goalScore = useGameStore((s) => s.goalScore);
  const goalHeight = useGameStore((s) => s.goalHeight);

  const scoreFrac = goalScore > 0 ? Math.min(1, score / goalScore) : 0;
  const heightFrac = goalHeight > 0 ? Math.min(1, height / goalHeight) : 0;

  return (
    <div className="absolute top-0 inset-x-0 px-2 sm:px-3 pt-[max(env(safe-area-inset-top),12px)] z-20 pointer-events-none">
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="panel pointer-events-auto px-2 sm:px-3 py-1.5 sm:py-2 min-w-[88px] sm:min-w-[112px]">
          <div className="text-[10px] uppercase tracking-widest text-white/70">Score</div>
          <div className="font-display text-xl sm:text-2xl leading-none">{score}</div>
          {mode === 'endless' && (
            <div className="text-[10px] mt-1 text-white/70">Level {level}</div>
          )}
          {combo > 1 && (
            <div className="mt-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-accent animate-pop">
              <span>x{combo}</span>
              <span className="text-white/70">combo</span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-1 sm:gap-2 pointer-events-auto min-w-0">
          <DifficultyBar difficulty={difficulty} />
          <div className="text-[10px] tracking-widest uppercase text-white/70 whitespace-nowrap">
            {Math.round(height / 6)}m tall
          </div>
        </div>

        <button
          onClick={onPause}
          className="panel pointer-events-auto w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-lg sm:text-xl active:scale-95 shrink-0"
          aria-label="Pause"
        >
          ⏸
        </button>
      </div>

      {(mode === 'daily' || mode === 'challenge') && challenge && (
        <div className="mt-3 panel px-3 py-2 pointer-events-auto">
          <div className="flex items-center justify-between">
            <div className="font-display text-sm">{challenge.name}</div>
            <div className="text-[10px] text-white/70 uppercase tracking-widest">
              {mode === 'daily' ? 'Daily' : 'Challenge'}
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <Bar label={`Score ${score}/${goalScore}`} frac={scoreFrac} />
            <Bar
              label={`Height ${Math.round(height / 6)}/${Math.round(goalHeight / 6)}m`}
              frac={heightFrac}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Bar({ label, frac }: { label: string; frac: number }) {
  return (
    <div>
      <div className="text-[10px] text-white/75">{label}</div>
      <div className="mt-1 h-1.5 rounded-full bg-surface-2 overflow-hidden">
        <div
          className="h-full bg-accent transition-all duration-300"
          style={{ width: `${Math.min(100, frac * 100)}%` }}
        />
      </div>
    </div>
  );
}
