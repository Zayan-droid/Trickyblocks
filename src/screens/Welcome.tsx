import { useNavigate } from 'react-router-dom';
import LogoMark from '@/components/LogoMark';
import { ensureAudio, playSfx } from '@/game/audio';
import { useProgressStore } from '@/store/progressStore';

export default function Welcome() {
  const nav = useNavigate();
  const totalSessions = useProgressStore((s) => s.totalSessions);
  const highScore = useProgressStore((s) => s.highScores['endless'] ?? 0);

  return (
    <div className="relative h-full w-full flex flex-col items-center justify-center px-4 sm:px-6 pt-[max(env(safe-area-inset-top),24px)] pb-[max(env(safe-area-inset-bottom),24px)] text-center">
      <div className="relative z-10 flex flex-col items-center gap-5 sm:gap-6 animate-rise max-w-md">
        <LogoMark size={96} />
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-display tracking-wide accent-text">
          TRICKY BLOCKS
        </h1>
        <p className="text-white/80 leading-snug">
          Stack the tower, ride the wobble, beat the day. A vibrant physics puzzle
          that adapts to how you play.
        </p>

        <button
          onClick={() => {
            ensureAudio();
            playSfx('click');
            nav('/menu');
          }}
          className="btn-primary text-2xl px-10 py-5 mt-2 animate-pulseGlow"
        >
          ▶ PLAY
        </button>

        <div className="mt-6 flex gap-3 text-sm text-white/60">
          <span>Sessions: {totalSessions}</span>
          <span>•</span>
          <span>High score: {highScore}</span>
        </div>
      </div>
    </div>
  );
}
