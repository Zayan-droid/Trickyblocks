import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import { useProgressStore } from '@/store/progressStore';
import { ensureAudio, playSfx } from '@/game/audio';

const ICE_ACCENT = '#5CB8E8';
const ICE_NAVY = '#233B63';
const ICE_NAVY_MUTED = '#3A6A8F';

const JELLY_ACCENT = '#FF7EB6';
const JELLY_PURPLE = '#6E5AA5';
const JELLY_PURPLE_MUTED = '#9A7FB5';

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
  const isJelly = platform === 'jelly';
  const isSoft = isIce || isJelly;

  // Per-soft-theme palette so the screen reads as the same world the player
  // just played in.
  const accent = isJelly ? JELLY_ACCENT : ICE_ACCENT;
  const strong = isJelly ? JELLY_PURPLE : ICE_NAVY;
  const muted = isJelly ? JELLY_PURPLE_MUTED : ICE_NAVY_MUTED;

  useEffect(() => {
    ensureAudio();
    playSfx(won ? 'milestone' : 'gameover', 0.7);
  }, [won]);

  const isHighScore = useMemo(() => score >= high && score > 0, [high, score]);

  const softBg = isIce
    ? {
        background:
          'linear-gradient(180deg, #F8FBFF 0%, #EAF6FF 55%, #BEE8FF 100%)',
      }
    : isJelly
      ? {
          background:
            'linear-gradient(180deg, #FFF8F1 0%, #FFE3EF 55%, #FFD8C7 100%)',
        }
      : undefined;

  const panelCls = isIce
    ? 'ice-panel p-5'
    : isJelly
      ? 'jelly-panel p-5'
      : 'panel p-5';
  const primaryBtnCls = isIce
    ? 'ice-btn-primary w-full text-lg'
    : isJelly
      ? 'jelly-btn-primary w-full text-lg'
      : 'btn-primary w-full text-lg';
  const ghostBtnCls = isIce
    ? 'ice-btn-ghost w-full'
    : isJelly
      ? 'jelly-btn-ghost w-full'
      : 'btn-ghost w-full';

  const titleColor = isSoft ? (won ? accent : strong) : undefined;
  const subTitleColor = isSoft ? muted : undefined;

  return (
    <div
      className="relative h-full w-full overflow-y-auto px-4 sm:px-6 py-8 sm:py-10 pt-[max(env(safe-area-inset-top),32px)] pb-[max(env(safe-area-inset-bottom),32px)] flex flex-col items-center justify-center"
      style={softBg}
    >
      <div className="relative z-10 w-full max-w-md flex flex-col items-center gap-5 animate-rise">
        <div
          className={`text-4xl sm:text-5xl font-display ${
            isSoft ? '' : won ? 'accent-text' : 'text-white'
          }`}
          style={isSoft ? { color: titleColor } : undefined}
        >
          {isSoft && <span className="mr-2">{isJelly ? '🍬' : '❄'}</span>}
          {won ? 'YOU WON!' : 'TOWER FELL'}
        </div>
        {challenge && (
          <div
            className={isSoft ? '' : 'text-white/80'}
            style={isSoft ? { color: subTitleColor } : undefined}
          >
            {challenge.name}
          </div>
        )}

        <div className={`${panelCls} w-full flex flex-col gap-3`}>
          <Row label="Score" value={score} highlight={isHighScore} soft={isSoft} accent={accent} strong={strong} muted={muted} />
          <Row label="Best" value={Math.max(score, high)} soft={isSoft} accent={accent} strong={strong} muted={muted} />
          {mode === 'endless' && (
            <Row label="Level reached" value={level} soft={isSoft} accent={accent} strong={strong} muted={muted} />
          )}
          <Row label="Blocks placed" value={stats.blocksPlaced} soft={isSoft} accent={accent} strong={strong} muted={muted} />
          <Row label="Best combo" value={stats.comboBest} soft={isSoft} accent={accent} strong={strong} muted={muted} />
          <Row label="Collapses" value={stats.collapses} soft={isSoft} accent={accent} strong={strong} muted={muted} />
          {isHighScore && (
            <div
              className="text-center font-display tracking-widest"
              style={isSoft ? { color: accent } : undefined}
            >
              {isJelly ? '🍬 NEW HIGH SCORE 🍬' : isIce ? '❄ NEW HIGH SCORE ❄' : '★ NEW HIGH SCORE ★'}
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
  soft,
  accent,
  strong,
  muted,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
  soft?: boolean;
  accent?: string;
  strong?: string;
  muted?: string;
}) {
  const labelCls = soft ? '' : 'text-white/75';
  const valueCls = soft
    ? `font-display ${highlight ? 'text-2xl' : 'text-lg'}`
    : `font-display ${highlight ? 'text-accent text-2xl' : 'text-white text-lg'}`;
  const valueStyle = soft
    ? { color: highlight ? accent : strong }
    : undefined;
  return (
    <div className="flex justify-between items-center">
      <span className={labelCls} style={soft ? { color: muted } : undefined}>
        {label}
      </span>
      <span className={valueCls} style={valueStyle}>
        {value}
      </span>
    </div>
  );
}
