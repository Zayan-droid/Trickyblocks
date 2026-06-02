import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import { useProgressStore } from '@/store/progressStore';
import { ensureAudio, playSfx } from '@/game/audio';

const ICE_ACCENT = '#5CB8E8';
const ICE_NAVY = '#233B63';
const ICE_NAVY_MUTED = '#3A6A8F';

export default function GameOver() {
  const nav = useNavigate();
  const phase = useGameStore((s) => s.phase);
  const score = useGameStore((s) => s.score);
  const mode = useGameStore((s) => s.mode);
  const platform = useGameStore((s) => s.platform);
  const challenge = useGameStore((s) => s.challenge);
  const stats = useGameStore((s) => s.stats);
  const level = useGameStore((s) => s.level);
  const high = useProgressStore((s) => s.highScores[mode] ?? 0);

  const won = phase === 'won';
  const isIce = platform === 'ice';

  useEffect(() => {
    ensureAudio();
    playSfx(won ? 'milestone' : 'gameover', 0.7);
  }, [won]);

  const isHighScore = useMemo(() => score >= high && score > 0, [high, score]);

  const iceBg = isIce
    ? {
        background:
          'linear-gradient(180deg, #F8FBFF 0%, #EAF6FF 55%, #BEE8FF 100%)',
      }
    : undefined;

  const panelCls = isIce ? 'ice-panel p-5' : 'panel p-5';
  const primaryBtnCls = isIce
    ? 'ice-btn-primary w-full text-lg'
    : 'btn-primary w-full text-lg';
  const ghostBtnCls = isIce
    ? 'ice-btn-ghost w-full'
    : 'btn-ghost w-full';

  const titleColor = isIce ? (won ? ICE_ACCENT : ICE_NAVY) : undefined;
  const subTitleColor = isIce ? ICE_NAVY_MUTED : undefined;

  return (
    <div
      className="relative h-full w-full overflow-y-auto px-4 sm:px-6 py-8 sm:py-10 pt-[max(env(safe-area-inset-top),32px)] pb-[max(env(safe-area-inset-bottom),32px)] flex flex-col items-center justify-center"
      style={iceBg}
    >
      <div className="relative z-10 w-full max-w-md flex flex-col items-center gap-5 animate-rise">
        <div
          className={`text-4xl sm:text-5xl font-display ${
            isIce ? '' : won ? 'accent-text' : 'text-white'
          }`}
          style={isIce ? { color: titleColor } : undefined}
        >
          {isIce && <span className="mr-2">❄</span>}
          {won ? 'YOU WON!' : 'TOWER FELL'}
        </div>
        {challenge && (
          <div
            className={isIce ? '' : 'text-white/80'}
            style={isIce ? { color: subTitleColor } : undefined}
          >
            {challenge.name}
          </div>
        )}

        <div className={`${panelCls} w-full flex flex-col gap-3`}>
          <Row label="Score" value={score} highlight={isHighScore} iceMode={isIce} />
          <Row label="Best" value={Math.max(score, high)} iceMode={isIce} />
          {mode === 'endless' && (
            <Row label="Level reached" value={level} iceMode={isIce} />
          )}
          <Row label="Blocks placed" value={stats.blocksPlaced} iceMode={isIce} />
          <Row label="Best combo" value={stats.comboBest} iceMode={isIce} />
          <Row label="Collapses" value={stats.collapses} iceMode={isIce} />
          {isHighScore && (
            <div
              className="text-center font-display tracking-widest"
              style={isIce ? { color: ICE_ACCENT } : undefined}
            >
              {isIce ? '❄ NEW HIGH SCORE ❄' : '★ NEW HIGH SCORE ★'}
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
          className={primaryBtnCls}
        >
          ↻ Play again
        </button>
        <button onClick={() => nav('/menu')} className={ghostBtnCls}>
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
  iceMode,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
  iceMode?: boolean;
}) {
  const labelColor = iceMode ? ICE_NAVY_MUTED : undefined;
  const labelCls = iceMode ? '' : 'text-white/75';
  const valueCls = iceMode
    ? `font-display ${highlight ? 'text-2xl' : 'text-lg'}`
    : `font-display ${highlight ? 'text-accent text-2xl' : 'text-white text-lg'}`;
  const valueStyle = iceMode
    ? { color: highlight ? ICE_ACCENT : ICE_NAVY }
    : undefined;
  return (
    <div className="flex justify-between items-center">
      <span className={labelCls} style={iceMode ? { color: labelColor } : undefined}>
        {label}
      </span>
      <span className={valueCls} style={valueStyle}>
        {value}
      </span>
    </div>
  );
}
