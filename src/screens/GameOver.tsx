import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import { useProgressStore } from '@/store/progressStore';
import { ensureAudio, playSfx } from '@/game/audio';

export default function GameOver() {
  const nav = useNavigate();
  const phase = useGameStore((s) => s.phase);
  const score = useGameStore((s) => s.score);
  const mode = useGameStore((s) => s.mode);
  const challenge = useGameStore((s) => s.challenge);
  const stats = useGameStore((s) => s.stats);
  const level = useGameStore((s) => s.level);
  const high = useProgressStore((s) => s.highScores[mode] ?? 0);

  const won = phase === 'won';

  useEffect(() => {
    ensureAudio();
    playSfx(won ? 'milestone' : 'gameover', 0.7);
  }, [won]);

  const isHighScore = useMemo(() => score >= high && score > 0, [high, score]);

  return (
    <div className="relative h-full w-full overflow-y-auto px-4 sm:px-6 py-8 sm:py-10 pt-[max(env(safe-area-inset-top),32px)] pb-[max(env(safe-area-inset-bottom),32px)] flex flex-col items-center justify-center">
      <div className="relative z-10 w-full max-w-md flex flex-col items-center gap-5 animate-rise">
        <div
          className={`text-4xl sm:text-5xl font-display ${won ? 'accent-text' : 'text-white'}`}
        >
          {won ? 'YOU WON!' : 'TOWER FELL'}
        </div>
        {challenge && <div className="text-white/80">{challenge.name}</div>}

        <div className="panel p-5 w-full flex flex-col gap-3">
          <Row label="Score" value={score} highlight={isHighScore} />
          <Row label="Best" value={Math.max(score, high)} />
          {mode === 'endless' && <Row label="Level reached" value={level} />}
          <Row label="Blocks placed" value={stats.blocksPlaced} />
          <Row label="Best combo" value={stats.comboBest} />
          <Row label="Collapses" value={stats.collapses} />
          {isHighScore && (
            <div className="text-center text-accent font-display tracking-widest">
              ★ NEW HIGH SCORE ★
            </div>
          )}
        </div>

        <button
          onClick={() => {
            const s = useGameStore.getState();
            s.resetGame(s.mode);
            s.setChallenge(challenge);
            if (challenge) s.setGoals(challenge.goalScore, challenge.goalHeight);
            nav('/play');
          }}
          className="btn-primary w-full text-lg"
        >
          ↻ Play again
        </button>
        <button onClick={() => nav('/menu')} className="btn-ghost w-full">
          ⏏ Main menu
        </button>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-white/75">{label}</span>
      <span
        className={`font-display ${highlight ? 'text-accent text-2xl' : 'text-white text-lg'}`}
      >
        {value}
      </span>
    </div>
  );
}
