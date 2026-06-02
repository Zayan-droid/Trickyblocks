import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import { useProgressStore } from '@/store/progressStore';
import { ensureAudio, playSfx } from '@/game/audio';
import type { PlatformType } from '@/game/types';

export default function EndlessSelect() {
  const nav = useNavigate();
  const { resetGame, setPlatform, setChallenge, setGoals } = useGameStore();
  const endless = useProgressStore((s) => s.endlessLevelReached);

  const start = (platform: PlatformType) => {
    ensureAudio();
    playSfx('click');
    resetGame('endless');
    setPlatform(platform);
    setChallenge(null);
    setGoals(0, 0);
    nav('/play');
  };

  return (
    <div className="relative h-full w-full overflow-y-auto px-4 sm:px-6 py-8 sm:py-10 pt-[max(env(safe-area-inset-top),32px)] pb-[max(env(safe-area-inset-bottom),32px)] flex justify-center">
      <div className="w-full max-w-2xl flex flex-col gap-5 animate-rise">
        <h2 className="text-3xl font-display accent-text">ENDLESS</h2>
        <p className="text-white/70 text-sm">
          Climb forever. Pick your world. Lv. {endless}+
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          <ModeTile
            title="Classic"
            blurb="The original endless climb. Wooden platform, themed palette."
            tagline="Wood · Themed"
            gradient="linear-gradient(135deg, #c47a3a 0%, #6e3f1a 100%)"
            icon="🪵"
            onClick={() => start('wood')}
          />
          <ModeTile
            title="Ice Mode"
            blurb="A frozen glacier world. Every block slides on a sheet of ice."
            tagline="Glacier · Slippery"
            gradient="linear-gradient(135deg, #9fd6ee 0%, #2c5d80 100%)"
            icon="❄"
            onClick={() => start('ice')}
          />
          <ModeTile
            title="Jelly Mode"
            blurb="A squishy candy world. Bouncy gummy blocks wobble on a giant jelly cake."
            tagline="Gummy · Bouncy"
            gradient="linear-gradient(135deg, #ff9ec7 0%, #b99bff 100%)"
            icon="🍮"
            onClick={() => start('jelly')}
          />
        </div>

        <button onClick={() => nav(-1)} className="btn-ghost mt-4 self-start">
          ← Back
        </button>
      </div>
    </div>
  );
}

function ModeTile({
  title,
  blurb,
  tagline,
  gradient,
  icon,
  onClick,
}: {
  title: string;
  blurb: string;
  tagline: string;
  gradient: string;
  icon: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left panel p-5 transition-transform hover:scale-[1.02] active:scale-[0.99] overflow-hidden relative"
    >
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{ background: gradient }}
        aria-hidden
      />
      <div className="relative flex items-start gap-3">
        <div className="text-3xl leading-none">{icon}</div>
        <div className="flex-1">
          <div className="font-display text-xl leading-tight">{title}</div>
          <div className="text-xs text-white/65 mt-1">{blurb}</div>
          <div className="mt-3">
            <span className="px-2 py-0.5 rounded-full uppercase tracking-wider text-[10px] bg-surface-2 text-white/80 border border-white/10">
              {tagline}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
